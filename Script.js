import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCOY7xiGlGu3b1L5M1DuylaULxHRfj7GrE",
    authDomain: "anime-battle-arena-c9777.firebaseapp.com",
    databaseURL: "https://anime-battle-arena-c9777-default-rtdb.firebaseio.com",
    projectId: "anime-battle-arena-c9777",
    storageBucket: "anime-battle-arena-c9777.firebasestorage.app",
    messagingSenderId: "756648612874",
    appId: "1:756648612874:web:5d15b4cf6e7dc26b247bf3",
    measurementId: "G-WET1B82Z64"
};

// Global State Management Memory Units
let database;
let currentRoomId = null;
let myPlayerType = "player1"; 
let gameplayMode = "bot";
let currentHand = [];
let selectedGameCard = null;
let assignmentSlots = { Battle: [], Mission: [], Rescue: [], Assassination: [] };

let localPlayerProfile = {
    username: "Challenger",
    level: 1,
    wins: 0
};

const structuralFallbackSpecials = [
    { name: "Gear 5 Upgrade", category: "Buff", value: 2, image: "" },
    { name: "Haki Burst", category: "Buff", value: 3, image: "" }
];

// ===================================================
// 2. IMMEDIATE GLOBAL WINDOW BINDING SYSTEM
// ===================================================
window.switchView = (screenId) => {
    document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
    const target = document.getElementById(screenId);
    if (target) target.classList.add("active");
};

window.toggleHandbook = (show) => {
    const overlay = document.getElementById("handbook-overlay");
    if (overlay) {
        if (show) overlay.classList.add("active");
        else overlay.classList.remove("active");
    }
};

window.toggleChatCollapse = () => {
    const chatPanel = document.getElementById("global-chat-panel");
    const toggleIcon = document.getElementById("chat-toggle-icon");
    if (chatPanel) {
        if (chatPanel.classList.contains("expanded")) {
            chatPanel.classList.remove("expanded");
            chatPanel.classList.add("minimized");
            if (toggleIcon) toggleIcon.innerText = "▲ Maximize";
        } else {
            chatPanel.classList.remove("minimized");
            chatPanel.classList.add("expanded");
            if (toggleIcon) toggleIcon.innerText = "▼ Minimize";
        }
    }
};

window.registerUserLogin = function() {
    // Your existing login code here...
    console.log("Login button clicked!");
};

window.submitGlobalChatMessage = function() {
    // Your existing chat message code here...
    console.log("Chat message sent!");
};

window.startBotGame = () => {
    gameplayMode = "bot";
    document.getElementById("game-player-identity").innerText = localPlayerProfile.username;
    document.getElementById("game-opponent-identity").innerText = "AI Enemy Bot";
    document.getElementById("round-tracker-text").innerText = "ROUND 1 (0 - 0)";
    window.switchView("game-screen");
    dealMatchDeck();
};

window.createOnlineRoom = () => {
    gameplayMode = "network";
    currentRoomId = "RM-" + Math.floor(Math.random() * 9000 + 1000);
    myPlayerType = "player1";

    set(ref(database, `rooms/${currentRoomId}`), {
        roomCode: currentRoomId,
        roundNumber: 1,
        status: "waiting",
        player1: { name: localPlayerProfile.username, roundWins: 0, lockedIn: false },
        player2: { name: "Waiting...", roundWins: 0, lockedIn: false }
    });

    window.switchView("match-lobby-screen");
    bindMatchRoomSocket();
};

window.joinOnlineRoom = () => {
    const codeField = document.getElementById("room-id-input");
    const enteredToken = codeField ? codeField.value.trim().toUpperCase() : "";
    if (!enteredToken) return alert("Please enter a room code.");

    gameplayMode = "network";
    currentRoomId = enteredToken;
    myPlayerType = "player2";

    get(ref(database, `rooms/${currentRoomId}`)).then((snapshot) => {
        if (!snapshot.exists()) return alert("Match registration token not discovered.");

        update(ref(database, `rooms/${currentRoomId}`), {
            "player2/name": localPlayerProfile.username,
            status: "ready"
        });

        window.switchView("match-lobby-screen");
        bindMatchRoomSocket();
    });
};

window.hostStartGame = () => {
    update(ref(database, `rooms/${currentRoomId}`), { status: "playing" });
};

// RESET FUNCTION - SAFELY KEEPS YOU IN THE CHOSEN ROOM OR SWITCHES MODES
window.restartGameSequence = (targetMode) => {
    currentHand = [];
    assignmentSlots = { Battle: [], Mission: [], Rescue: [], Assassination: [] };
    selectedGameCard = null;

    const scroller = document.getElementById("hand-scroller-container");
    if (scroller) scroller.style.display = "block";

    if (targetMode === "bot") {
        window.startBotGame();
    } else if (targetMode === "network" && currentRoomId) {
        document.getElementById("report-content-payload").innerHTML = "<h3>Resetting arena boards...</h3>";
        if (myPlayerType === "player1") {
            update(ref(database, `rooms/${currentRoomId}`), {
                roundNumber: 1,
                status: "playing",
                "player1/roundWins": 0,
                "player1/lockedIn": false,
                "player1/lineup": null,
                "player2/roundWins": 0,
                "player2/lockedIn": false,
                "player2/lineup": null
            });
        } else {
            update(ref(database, `rooms/${currentRoomId}`), {
                "player2/lockedIn": false,
                "player2/lineup": null
            });
            window.switchView("game-screen");
        }
    } else {
        window.switchView("lobby-screen");
    }
};

window.lockInChoices = () => {
    for (let lane in assignmentSlots) {
        if (!assignmentSlots[lane] || assignmentSlots[lane].length === 0) {
            return alert(`Please deploy an operative into the ${lane.toUpperCase()} category corridor.`);
        }
    }

    let payload = {};
    for (let lane in assignmentSlots) {
        let cardObj = assignmentSlots[lane][0];
        payload[lane] = cardObj.isSpecial ? 
            { name: cardObj.name, isSpecial: true, category: cardObj.category || "Buff", value: cardObj.value || 1 } :
            { name: cardObj.name, isSpecial: false, Battle: cardObj.Battle || cardObj.battle || 5, Mission: cardObj.Mission || cardObj.mission || 5, Rescue: cardObj.Rescue || cardObj.rescue || 5, Assassination: cardObj.Assassination || cardObj.assassination || 5 };
    }

    if (gameplayMode === "bot") {
        window.switchView("report-screen");
        document.getElementById("report-content-payload").innerHTML = "<h2>📊 COMPUTING COMBAT LOGS...</h2>";
        setTimeout(() => { processBotSimulationReport(payload); }, 1000);
    } else {
        document.getElementById("hand-scroller-container").style.display = "none";
        document.getElementById("arena").innerHTML = "<h2 style='grid-column:1/-1; text-align:center; color:#ffd700;'>🔒 Setup Locked. Awaiting opponent calculations...</h2>";
        
        let updates = {};
        updates[`rooms/${currentRoomId}/${myPlayerType}/lineup`] = payload;
        updates[`rooms/${currentRoomId}/${myPlayerType}/lockedIn`] = true;
        update(ref(database), updates);
    }
};

window.submitGlobalChatMessage = () => {
    const input = document.getElementById("chat-msg-field");
    const txt = input ? input.value.trim() : "";
    if (!txt) return;

    push(ref(database, "global_chats"), { user: localPlayerProfile.username || "Guest", text: txt });
    input.value = "";
};

window.syncGlobalChatFeed = () => {
    onValue(ref(database, "global_chats"), (snapshot) => {
        const feed = document.getElementById("chat-box-feed");
        if (!feed) return;
        feed.innerHTML = "";
        snapshot.forEach((child) => {
            const msg = child.val();
            feed.innerHTML += `<p style="margin:3px 0; font-size:0.82rem;"><strong style="color:#00ff88;">${msg.user}:</strong> ${msg.text}</p>`;
        });
        feed.scrollTop = feed.scrollHeight;
    });
};

window.loadLeaderboardView = () => {
    window.switchView("leaderboard-screen");
    get(ref(database, "leaderboard_scores")).then((snapshot) => {
        const wrapper = document.getElementById("leaderboard-ranks-wrapper");
        if (!wrapper) return;
        wrapper.innerHTML = "";
        if (!snapshot.exists()) {
            wrapper.innerHTML = `<div style="color:#555565; text-align:center;">No rankings recorded yet.</div>`;
            return;
        }
        
        let records = [];
        snapshot.forEach((child) => {
            records.push(child.val());
        });

        // Sort dynamically highest wins first
        records.sort((a, b) => b.wins - a.wins);

        records.forEach((row) => {
            wrapper.innerHTML += `<div style="display:flex; justify-content:space-between; background:#0d0d0f; padding:12px; margin-bottom:6px; border-radius:4px; border:1px solid #24242e;"><span>👤 ${row.name}</span><span style="color:#ffd700; font-weight:bold;">${row.wins} Wins</span></div>`;
        });
    });
};

// ===================================================
// 3. INTERNAL ENGINE MULTIPLAYER ROOM LISTENERS
// ===================================================
function initGameEngine() {
    try {
        const app = initializeApp(firebaseConfig);
        database = getDatabase(app);
        console.log("🚀 Live connection validated: Firebase Core Online.");
    } catch (e) {
        console.error("Critical Engine Core Fault during init:", e);
    }
}

function bindMatchRoomSocket() {
    onValue(ref(database, `rooms/${currentRoomId}`), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // UI text elements validation
        const titleEl = document.getElementById("match-room-title");
        if(titleEl) titleEl.innerText = `ROOM CODE: ${data.roomCode}`;
        
        const p1El = document.getElementById("lobby-p1-name");
        if(p1El) p1El.innerText = data.player1 ? data.player1.name : "Host";
        
        const p2El = document.getElementById("lobby-p2-name");
        if(p2El) p2El.innerText = data.player2 ? data.player2.name : "Waiting...";

        const p2Status = document.getElementById("lobby-p2-status");
        if (p2Status) {
            if (data.status === "ready" || data.status === "playing") {
                p2Status.innerText = "CONNECTED";
                if (myPlayerType === "player1" && data.status === "ready") {
                    document.getElementById("host-controls-wrapper").style.display = "block";
                }
            } else {
                p2Status.innerText = "PENDING";
            }
        }

        if (data.status === "playing") {
            document.getElementById("game-player-identity").innerText = myPlayerType === "player1" ? data.player1.name : data.player2.name;
            document.getElementById("game-opponent-identity").innerText = myPlayerType === "player1" ? data.player2.name : data.player1.name;
            document.getElementById("round-tracker-text").innerText = `ROUND ${data.roundNumber} (${data.player1.roundWins} - ${data.player2.roundWins})`;
            
            const containerNode = document.getElementById("hand-scroller-container");
            if (containerNode) containerNode.style.display = "block";
            
            window.switchView("game-screen");
            if (currentHand.length === 0) dealMatchDeck();
        }

        if (data.player1 && data.player2 && data.player1.lockedIn && data.player2.lockedIn) {
            processNetworkBattleReport(data);
        }
    });
}

// ===================================================
// 4. CARDS RENDERING & INTERACTION LANES ENGINE
// ===================================================
function dealMatchDeck() {
    assignmentSlots = { Battle: [], Mission: [], Rescue: [], Assassination: [] };
    selectedGameCard = null;

    let activeCharactersList = [];
    if (typeof window.characters !== "undefined") {
        activeCharactersList = window.characters;
    } else if (typeof characters !== "undefined") {
        activeCharactersList = characters;
    } else {
        try {
            activeCharactersList = Function("return characters;")();
        } catch (e) {
            console.error("⚠️ Failed to load array variables from characters.js");
        }
    }

    let activeSpecials = (typeof window.specials !== "undefined") ? window.specials : ((typeof specials !== "undefined") ? specials : structuralFallbackSpecials);
    let processedSpecials = activeSpecials.map(card => ({ ...card, isSpecial: true }));

    // Core rule split constraints: 5 Operatives + 1 Tactical Special
    let randomHeroes = [...activeCharactersList].sort(() => 0.5 - Math.random()).slice(0, 5);
    let randomSpecials = [...processedSpecials].sort(() => 0.5 - Math.random()).slice(0, 1);
    
    currentHand = [...randomHeroes, ...randomSpecials];
    renderDeckCardsStrip();
    resetUIArenaLanes();
}

function resetUIArenaLanes() {
    for (let slotKey in assignmentSlots) {
        const slot = document.querySelector(`.slot[data-type="${slotKey}"]`);
        if (slot) {
            slot.innerHTML = `<h3>${slotKey.toUpperCase()}</h3><div class="lane-status-subtext">Empty corridor</div>`;
            slot.style.borderColor = "#24242e";
            slot.style.background = "#121214";
        }
    }
    initializeSlotInteractions();
}

function renderDeckCardsStrip() {
    const container = document.getElementById("hand");
    if (!container) return;
    container.innerHTML = "";

    currentHand.forEach((unitData, index) => {
        const cardBox = document.createElement("div");
        cardBox.className = "card";
        cardBox.setAttribute("data-index", index);
        
        let rawSrc = unitData.image || unitData.src || unitData.photo || unitData.driveLink || unitData.img || "";
        let finalSrc = rawSrc;

        // ACCURATE MOBILE GOOGLE DRIVE EXTRACTION ENGINE
        if (rawSrc.includes("drive.google.com")) {
            let fileId = "";
            
            if (rawSrc.includes("/d/")) {
                fileId = rawSrc.split("/d/")[1].split("/")[0];
            } else if (rawSrc.includes("id=")) {
                fileId = rawSrc.split("id=")[1].split("&")[0];
            } else if (rawSrc.includes("open?id=")) {
                fileId = rawSrc.split("open?id=")[1].split("&")[0];
            }
            
            if (fileId) {
                // Completely fixed template string formatting for mobile browsers
                finalSrc = `https://wsrv.nl/?url=https://docs.google.com/uc?export=download&id=${fileId}`;
            }
        }

        // Pure image card layout (no text box titles)
        cardBox.innerHTML = `
            <div class="card-image-frame" style="height: 100%; width: 100%; position: relative; border-radius: inherit; overflow: hidden;">
                ${finalSrc ? `<img src="${finalSrc}" alt="Card" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\'card-fallback-art\'>🎴</div>';">` : `<div class="card-fallback-art">🎴</div>`}
            </div>
        `;

        cardBox.onclick = () => {
            if(cardBox.style.opacity === "0.2") return;

            selectedGameCard = { card: unitData, element: cardBox, index: index };
            document.querySelectorAll("#hand .card").forEach(c => {
                if(c.style.opacity !== "0.2") c.style.borderColor = "#ff4500";
            });
            cardBox.style.borderColor = "#00ff88";
        };
        container.appendChild(cardBox);
    });
}


function initializeSlotInteractions() {
    document.querySelectorAll(".slot").forEach(slot => {
        const cleanNode = slot.cloneNode(true);
        slot.parentNode.replaceChild(cleanNode, slot);

        // CLICK TO DEPLOY OR CLICK TO RETURN/UNSELECT
        cleanNode.addEventListener("click", () => {
            const lane = cleanNode.getAttribute("data-type");
            
            // IF SLOT HAS A CARD: Click it again to return it to your hand (Deselect/Move mechanism)
            if (assignmentSlots[lane] && assignmentSlots[lane].length > 0) {
                let returnedCard = assignmentSlots[lane][0];
                
                // Find matching element strip card and restore opacity state
                document.querySelectorAll("#hand .card").forEach(c => {
                    if (parseInt(c.getAttribute("data-index")) === returnedCard._handIndex) {
                        c.style.opacity = "1";
                        c.style.borderColor = "#ff4500";
                    }
                });

                assignmentSlots[lane] = [];
                cleanNode.innerHTML = `<h3>${lane.toUpperCase()}</h3><div class="lane-status-subtext">Empty corridor</div>`;
                cleanNode.style.borderColor = "#24242e";
                cleanNode.style.background = "#121214";
                return;
            }

            // IF SLOT IS EMPTY: Deploy current highlighted card
            if (!selectedGameCard) return;

            // Track index tag directly onto asset reference for seamless return path tracking
            let cardPayload = { ...selectedGameCard.card, _handIndex: selectedGameCard.index };
            assignmentSlots[lane] = [cardPayload];
            
            cleanNode.innerHTML = `
                <div style="text-align:center; padding:10px;">
                    <div style="font-weight:bold; color:#00ff88; font-size:0.9rem; margin-bottom:4px;">${cardPayload.isSpecial ? '✨ ' : ''}${cardPayload.name}</div>
                    <div style="color:#8a8a98; font-size:0.7rem;">Click to retract card</div>
                </div>
            `;
            cleanNode.style.borderColor = "#00ff88";
            cleanNode.style.background = "#161c18";

            selectedGameCard.element.style.opacity = "0.2";
            selectedGameCard.element.style.borderColor = "#24242e";
            selectedGameCard = null;
        });
    });
}

// ===================================================
// 5. SCORE UPDATER & LEADERBOARD DATA SYNC OUTLET
// ===================================================
function saveMatchWinnerToLeaderboard(winnerName) {
    if (!winnerName || winnerName.includes("Waiting") || winnerName.includes("AI")) return;
    
    const scoresRef = ref(database, "leaderboard_scores");
    get(scoresRef).then((snapshot) => {
        let recordKey = null;
        let existingWins = 0;

        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                if (child.val().name === winnerName) {
                    recordKey = child.key;
                    existingWins = child.val().wins || 0;
                }
            });
        }

        if (recordKey) {
            update(ref(database, `leaderboard_scores/${recordKey}`), { wins: existingWins + 1 });
        } else {
            push(scoresRef, { name: winnerName, wins: 1 });
        }
        console.log(`🏆 Leaderboard synchronized safely for profile player: ${winnerName}`);
    });
}

// ===================================================
// 6. SCORING FEED SIMULATIONS & ACTION BUTTON PANELS
// ===================================================
function processBotSimulationReport(lineup) {
    let p = 0, b = 0;
    let html = `<h2 style="color:#ffd700; text-align:center;">⚔️ TRAINING COMBAT FEED</h2><hr style="border-color:#24242e;">`;

    ["Battle", "Mission", "Rescue", "Assassination"].forEach(lane => {
        let uCard = lineup[lane];
        let uStat = uCard.isSpecial ? 7 : (uCard[lane] || 5);
        let botStat = Math.floor(Math.random() * 5) + 5;
        html += `<p style="font-size:0.85rem;"><strong>${lane.toUpperCase()}:</strong> Your ${uCard.name} (${uStat}) vs Robot AI (${botStat}) &rarr; `;
        if (uStat > botStat) { p++; html += "<span style='color:#00ff88; font-weight:bold;'>Won</span></p>"; }
        else if (botStat > uStat) { b++; html += "<span style='color:#ff4500; font-weight:bold;'>Lost</span></p>"; }
        else { p++; b++; html += "<span style='color:#ffd700;'>Split</span></p>"; }
    });

    let isMatchWon = p > b;
    if (isMatchWon) {
        saveMatchWinnerToLeaderboard(localPlayerProfile.username);
    }

    html += `
        <hr style="border-color:#24242e;">
        <h3 style="color:#00ff88; text-align:center;">${isMatchWon ? '🏆 TRAINING SECTIONS SUCCESSFUL!' : '❌ COMBAT MODULE CRITICAL'}</h3>
        
        <div class="end-game-options" style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
            <button class="btn success huge" onclick="window.restartGameSequence('bot')">🔄 Play Again (VS BOT AI)</button>
            <button class="btn primary huge" onclick="window.switchView('lobby-screen')">🏢 Return to Main Lobby</button>
        </div>
    `;
    document.getElementById("report-content-payload").innerHTML = html;
}

function processNetworkBattleReport(roomData) {
    window.switchView("report-screen");
    const l1 = roomData.player1.lineup;
    const l2 = roomData.player2.lineup;
    let p1 = 0, p2 = 0;

    let html = `<h2 style="color:#ffd700; text-align:center;">⚔️ SYSTEM SCORECARD (ROUND ${roomData.roundNumber})</h2><hr style="border-color:#24242e;">`;

    ["Battle", "Mission", "Rescue", "Assassination"].forEach(lane => {
        let card1 = l1[lane];
        let card2 = l2[lane];
        
        let stat1 = card1.isSpecial ? 7 : (card1[lane] || 5);
        let stat2 = card2.isSpecial ? 7 : (card2[lane] || 5);
        
        html += `<p style="font-size:0.85rem;"><strong>${lane.toUpperCase()}:</strong> ${roomData.player1.name} (${stat1}) vs ${roomData.player2.name} (${stat2}) &rarr; `;
        if (stat1 > stat2) { p1++; html += "<span style='color:#00ff88;'>Host Point</span></p>"; }
        else if (stat2 > stat1) { p2++; html += "<span style='color:#00bcff;'>Guest Point</span></p>"; }
        else { p1++; p2++; html += "<span style='color:#ffd700;'>Split</span></p>"; }
    });

    let w1 = roomData.player1.roundWins + (p1 > p2 ? 1 : p2 > p1 ? 0 : 1);
    let w2 = roomData.player2.roundWins + (p2 > p1 ? 1 : p1 > p2 ? 0 : 1);

    html += `<hr style="border-color:#24242e;"><h4>Current Standing: ${roomData.player1.name} [${w1}] | ${roomData.player2.name} [${w2}]</h4>`;

    if (w1 >= 2 || w2 >= 2 || roomData.roundNumber >= 3) {
        let finalWinner = w1 > w2 ? roomData.player1.name : roomData.player2.name;
        
        // Push actual confirmed winner identity safely to server records
        saveMatchWinnerToLeaderboard(finalWinner);

        html += `
            <h2 style="color:#ffd700; text-align:center;">🏆 MATCH COMPLETE: ${finalWinner.toUpperCase()} SECURES THE HUB SERIES!</h2>
            <div class="end-game-options" style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                <button class="btn success huge" onclick="window.restartGameSequence('network')">⚔️ Play Another Match (Keep Room Code)</button>
                <button class="btn info huge" onclick="window.restartGameSequence('bot')">🤖 Switch to Bot AI Training</button>
                <button class="btn primary huge" onclick="window.switchView('lobby-screen')">🚪 Back to Main Lobby Hub</button>
            </div>
        `;
    } else {
        html += `<div style="display:flex; gap:10px; margin-top:15px;"><button id="next-round-trigger" class="btn success huge" style="flex:1;">ADVANCE TO NEXT ROUND</button></div>`;
    }

    document.getElementById("report-content-payload").innerHTML = html;
    
    const btn = document.getElementById("next-round-trigger");
    if (btn) {
        btn.onclick = () => {
            currentHand = []; 
            document.getElementById("report-content-payload").innerHTML = "<h3>Syncing network database parameters...</h3>";
            if (myPlayerType === "player1") {
                update(ref(database, `rooms/${currentRoomId}`), { 
                    roundNumber: roomData.roundNumber + 1, 
                    "player1/roundWins": w1, 
                    "player2/roundWins": w2, 
                    "player1/lockedIn": false, 
                    "player2/lockedIn": false 
                });
            } else {
                update(ref(database, `rooms/${currentRoomId}`), { "player2/lockedIn": false });
            }
        };
    }
}

// Start core execution sequence loops instantly on file read
window.addEventListener("DOMContentLoaded", () => {
    initGameEngine();
    if (typeof resetUIArenaLanes === "function") {
        resetUIArenaLanes();
    }
});
