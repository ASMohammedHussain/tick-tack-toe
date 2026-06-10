const URL = "./my_model/";

const startButton = document.getElementById("start-button");
const resetButton = document.getElementById("reset-button");
const refreshButton = document.getElementById("refresh-button");
const statusEl = document.getElementById("status");
const gestureStatus = document.getElementById("gesture-status");
const boardEl = document.getElementById("board");
const webcamContainer = document.getElementById("webcam-container");
const labelContainer = document.getElementById("label-container");
const cameraSelect = document.getElementById("camera-select");

let model, webcam, maxPredictions;
let board = Array(9).fill("");
let currentPlayer = "X";
let isGameOver = false;
let lastGestureTime = 0;
const gestureDebounceMs = 250;
const gestureConfidenceThreshold = 0.45;
let videoInputs = [];
let preferredCameraId = undefined;


const gestureToIndex = {
    "one": 0,
    "1": 0,
    "cell 1": 0,
    "two": 1,
    "2": 1,
    "cell 2": 1,
    "three": 2,
    "3": 2,
    "cell 3": 2,
    "four": 3,
    "4": 3,
    "cell 4": 3,
    "five": 4,
    "5": 4,
    "cell 5": 4,
    "six": 5,
    "6": 5,
    "cell 6": 5,
    "seven": 6,
    "7": 6,
    "cell 7": 6,
    "eight": 7,
    "8": 7,
    "cell 8": 7,
    "nine": 8,
    "9": 8,
    "cell 9": 8,
};

startButton.addEventListener("click", async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusEl.textContent = "Camera support is not available in this browser. Use Chrome, Edge, or Firefox on HTTPS/localhost.";
        return;
    }

    startButton.disabled = true;
    startButton.textContent = "Starting...";
    statusEl.textContent = "Requesting camera access...";
    gestureStatus.textContent = "Opening webcam preview...";

    const allowed = await requestCameraPermission();
    if (!allowed) {
        statusEl.textContent = "Camera access denied or blocked. Allow webcam permission and refresh the page.";
        gestureStatus.textContent = "Camera preview blocked. Use HTTPS/localhost and accept camera permission.";
        startButton.disabled = false;
        startButton.textContent = "Start Camera";
        return;
    }

    await listVideoInputs();
    await initializeGestureModel();
    await startWebcam();
    startButton.textContent = "Camera Started";
    statusEl.textContent = "Show a hand gesture to select a square.";
});

window.addEventListener("DOMContentLoaded", async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        await requestCameraPermission();
        await listVideoInputs();
    }
});

refreshButton.addEventListener("click", async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    statusEl.textContent = "Refreshing camera list...";
    await requestCameraPermission();
    await listVideoInputs();
    statusEl.textContent = "Select a camera and press Start Camera.";
});

resetButton.addEventListener("click", resetGame);

boardEl.addEventListener("click", (event) => {
    if (!event.target.matches(".cell") || isGameOver) return;
    const index = Number(event.target.dataset.index);
    handleMove(index);
});

function createBoard() {
    boardEl.innerHTML = "";
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.index = i;
        cell.textContent = board[i];
        boardEl.appendChild(cell);
    }
}

function updateBoard() {
    document.querySelectorAll(".cell").forEach((cell) => {
        const index = Number(cell.dataset.index);
        cell.textContent = board[index];
    });
}

function resetGame() {
    board = Array(9).fill("");
    currentPlayer = "X";
    isGameOver = false;
    statusEl.textContent = "Game reset. Press a gesture or click a square.";
    updateBoard();
}

function handleMove(index) {
    if (isGameOver) return;
    if (board[index]) {
        statusEl.textContent = "That square is already taken. Try another one.";
        return;
    }
    board[index] = currentPlayer;
    updateBoard();

    const winner = checkWinner();
    if (winner) {
        statusEl.textContent = `Player ${winner} wins!`;
        isGameOver = true;
        return;
    }

    if (!board.includes("")) {
        statusEl.textContent = "It's a tie!";
        isGameOver = true;
        return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusEl.textContent = `Player ${currentPlayer}'s turn.`;
}

function checkWinner() {
    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

async function initializeGestureModel() {
    if (model) return;
    try {
        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        labelContainer.innerHTML = "";
        for (let i = 0; i < maxPredictions; i++) {
            const label = document.createElement("div");
            labelContainer.appendChild(label);
        }
    } catch (error) {
        console.error(error);
        statusEl.textContent = "Failed to load model. Make sure my_model/model.json exists.";
        startButton.disabled = false;
        startButton.textContent = "Start Camera";
    }
}

async function requestCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
    } catch (error) {
        console.error("Camera permission request failed:", error);
        return false;
    }
}

async function listVideoInputs() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoInputs = devices.filter((device) => device.kind === "videoinput");
        cameraSelect.innerHTML = "";
        if (videoInputs.length === 0) {
            const option = document.createElement("option");
            option.textContent = "No webcam detected";
            cameraSelect.appendChild(option);
            return;
        }

        const integratedKeywords = ["integrated", "built-in", "builtin", "internal", "face", "front", "webcam"];
        let autoSelectIndex = 0;
        preferredCameraId = undefined;

        videoInputs.forEach((device, index) => {
            const option = document.createElement("option");
            option.value = device.deviceId;
            option.textContent = device.label || `System Webcam ${index + 1}`;
            cameraSelect.appendChild(option);
            const label = (device.label || "").toLowerCase();
            if (autoSelectIndex === 0 && integratedKeywords.some((keyword) => label.includes(keyword))) {
                autoSelectIndex = index;
                preferredCameraId = device.deviceId;
            }
        });

        cameraSelect.selectedIndex = autoSelectIndex;

        if (!preferredCameraId && videoInputs.length > 0) {
            preferredCameraId = videoInputs[0].deviceId;
        }
    } catch (error) {
        console.error(error);
        cameraSelect.innerHTML = "";
        const option = document.createElement("option");
        option.textContent = "Camera access required";
        cameraSelect.appendChild(option);
    }
}

function stopWebcam() {
    if (!webcam) return;
    if (typeof webcam.stop === "function") {
        webcam.stop();
    }
    webcam = null;
}

async function startWebcam() {
    if (!model) return;
    stopWebcam();
    const flip = true;
    webcam = new tmImage.Webcam(320, 320, flip);
    const selectedDeviceId = cameraSelect.value && cameraSelect.value !== "" ? cameraSelect.value : preferredCameraId;
    const constraints = selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: "user" };
    try {
        await webcam.setup({ video: constraints });
    } catch (error) {
        console.warn("Selected camera setup failed, using default camera:", error);
        await webcam.setup();
    }
    await webcam.play();
    webcamContainer.innerHTML = "";
    webcamContainer.appendChild(webcam.canvas);
    gestureStatus.textContent = "Webcam active. Waiting for gesture input...";
    window.requestAnimationFrame(loop);
}

async function loop() {
    if (!webcam) return;
    webcam.update();
    await predictGesture();
    window.requestAnimationFrame(loop);
}

function normalizeClassName(name) {
    return name.trim().toLowerCase();
}

async function predictGesture() {
    if (!model || !webcam) return;
    const prediction = await model.predict(webcam.canvas);
    prediction.forEach((result, index) => {
        const labelRow = labelContainer.childNodes[index];
        if (labelRow) {
            labelRow.innerHTML = `${result.className}: ${result.probability.toFixed(2)}`;
        }
    });

    const best = prediction.reduce((prev, current) => prev.probability > current.probability ? prev : current);
    const className = normalizeClassName(best.className);
    gestureStatus.textContent = `Detected: ${best.className} (${best.probability.toFixed(2)})`;

    if (best.probability < gestureConfidenceThreshold) return;
    const index = gestureToIndex[className] ?? gestureToIndex[className.replace(/\s+/g, " ")];
    if (index == null) return;

    const now = Date.now();
    if (now - lastGestureTime < gestureDebounceMs) return;
    lastGestureTime = now;
    handleMove(index);
}

createBoard();
