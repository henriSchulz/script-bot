require('dotenv').config(); // Lädt Variablen aus .env
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

// 1. KONFIGURATION & SICHERHEITS-CHECK
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ FEHLER: Kein API-Key gefunden. Bitte 'GEMINI_API_KEY' in der .env Datei setzen.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = "gemini-2.5-flash"; 

// 2. IEEE SYMBOL BIBLIOTHEK (Analog & Digital Mix)
// Alle Symbole sind auf 50x50 Grid ausgelegt.
const SYMBOLS = {
    // Passive
    RESISTOR: (id) => `<g id="${id}"><path d="M0,25 H10 L15,15 L20,35 L25,15 L30,35 L35,15 L40,35 L45,25 H50" fill="none" stroke="black" stroke-width="2"/><text x="15" y="10" font-family="sans-serif" font-size="8">R</text></g>`,
    CAPACITOR: (id) => `<g id="${id}"><line x1="0" y1="25" x2="22" y2="25" stroke="black" stroke-width="2"/><line x1="28" y1="25" x2="50" y2="25" stroke="black" stroke-width="2"/><line x1="22" y1="10" x2="22" y2="40" stroke="black" stroke-width="2"/><line x1="28" y1="10" x2="28" y2="40" stroke="black" stroke-width="2"/><text x="15" y="10" font-family="sans-serif" font-size="8">C</text></g>`,
    INDUCTOR: (id) => `<g id="${id}"><path d="M0,25 H10 Q15,10 20,25 Q25,10 30,25 Q35,10 40,25 H50" fill="none" stroke="black" stroke-width="2"/><text x="15" y="10" font-family="sans-serif" font-size="8">L</text></g>`,
    
    // Aktive
    NMOS: (id) => `<g id="${id}"><path d="M25,10 V18 M25,32 V40 M10,25 H18 M25,18 V32 M18,18 V32" fill="none" stroke="black" stroke-width="2"/><polygon points="25,25 32,25 28.5,28" fill="black"/><line x1="25" y1="18" x2="35" y2="18" stroke="black" stroke-width="2"/><line x1="25" y1="32" x2="35" y2="32" stroke="black" stroke-width="2"/><line x1="35" y1="10" x2="35" y2="18" stroke="black" stroke-width="2"/><line x1="35" y1="32" x2="35" y2="40" stroke="black" stroke-width="2"/><text x="0" y="10" font-family="sans-serif" font-size="8">NMOS</text></g>`,
    PMOS: (id) => `<g id="${id}"><path d="M25,10 V18 M25,32 V40 M10,25 H15 M25,18 V32 M18,18 V32" fill="none" stroke="black" stroke-width="2"/><circle cx="16.5" cy="25" r="1.5" stroke="black" fill="white"/><polygon points="25,25 32,25 28.5,22" fill="black"/><line x1="25" y1="18" x2="35" y2="18" stroke="black" stroke-width="2"/><line x1="25" y1="32" x2="35" y2="32" stroke="black" stroke-width="2"/><line x1="35" y1="10" x2="35" y2="18" stroke="black" stroke-width="2"/><line x1="35" y1="32" x2="35" y2="40" stroke="black" stroke-width="2"/><text x="0" y="10" font-family="sans-serif" font-size="8">PMOS</text></g>`,

    // Sources
    GND: (id) => `<g id="${id}"><line x1="25" y1="0" x2="25" y2="15" stroke="black" stroke-width="2"/><line x1="10" y1="15" x2="40" y2="15" stroke="black" stroke-width="2"/><line x1="15" y1="20" x2="35" y2="20" stroke="black" stroke-width="2"/><line x1="20" y1="25" x2="30" y2="25" stroke="black" stroke-width="2"/></g>`,
    VCC: (id) => `<g id="${id}"><line x1="25" y1="50" x2="25" y2="35" stroke="black" stroke-width="2"/><circle cx="25" cy="30" r="5" fill="none" stroke="black"/><text x="32" y="35" font-family="sans-serif" font-size="10">V+</text></g>`,
    INPUT: (id) => `<g id="${id}"><rect x="0" y="15" width="20" height="20" fill="none" stroke="black"/><text x="5" y="28" font-size="10">IN</text><line x1="20" y1="25" x2="50" y2="25" stroke="black"/></g>`,
    OUTPUT: (id) => `<g id="${id}"><line x1="0" y1="25" x2="30" y2="25" stroke="black"/><path d="M30,25 L50,25" stroke="black"/><circle cx="52" cy="25" r="3" fill="none" stroke="black"/><text x="35" y="15" font-size="10">OUT</text></g>`
};

// 3. LLM PROMPT (ENGINEER)
const SYSTEM_PROMPT = `
Du bist ein Analog-IC-Layout-Ingenieur. Erstelle eine Netzliste und ein Grid-Layout.
Output Format: JSON Array.
Grid Größe: 0-10 (x), 0-10 (y).

Regeln:
1. Signalfluss: Links -> Rechts.
2. VCC oben (y=0 bis 2), GND unten (y=6 bis 10).
3. "connections": Bauteile mit gleichen Strings im Array sind verbunden.
4. "rotation": 0 (Horizontal), 90 (Vertikal, Pin1 oben), 180, 270 (Vertikal, Pin1 unten).

Typen: RESISTOR, CAPACITOR, INDUCTOR, NMOS, PMOS, VCC, GND, INPUT, OUTPUT.

Beispiel JSON:
[
  {"type": "VCC", "x": 5, "y": 0, "rotation": 0, "connections": ["vdd"]},
  {"type": "RESISTOR", "x": 5, "y": 1, "rotation": 90, "connections": ["vdd", "drain_node"]},
  {"type": "NMOS", "x": 5, "y": 3, "rotation": 0, "connections": ["gate_in", "drain_node", "src_gnd"]},
  {"type": "GND", "x": 5, "y": 4, "rotation": 0, "connections": ["src_gnd"]}
]
`;

async function generateCircuit(description) {
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nAufgabe: ${description}`);
    return JSON.parse(result.response.text());
}

// 4. SVG RENDERER
function renderSVG(components) {
    const GRID_S = 60;
    let svg = "";
    let wires = {}; // Speichert Koordinaten für Routing

    // -- A. Bauteile platzieren --
    components.forEach((c, i) => {
        const cx = c.x * GRID_S + 50;
        const cy = c.y * GRID_S + 50;
        const rot = c.rotation || 0;
        
        if (SYMBOLS[c.type]) {
            // Bauteil zeichnen
            svg += `<g transform="translate(${cx}, ${cy}) rotate(${rot}, 25, 25)">${SYMBOLS[c.type](`c${i}`)}</g>`;
            
            // Pins registrieren (damit wir wissen, wo die Drähte hinmüssen)
            registerPins(c, cx, cy, rot, wires);
        }
    });

    // -- B. Drähte ziehen (Auto-Router) --
    Object.keys(wires).forEach(netName => {
        const points = wires[netName];
        if (points.length > 1) {
            // Berechne Zentrum des Netzes
            const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
            const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

            // Zeichne Verbindungen zum Zentrum ("Star Topology" Layout)
            points.forEach(p => {
                svg += `<path d="M${p.x},${p.y} L${centerX},${p.y} L${centerX},${centerY}" stroke="blue" stroke-width="1.5" fill="none"/>`;
                svg += `<circle cx="${p.x}" cy="${p.y}" r="2" fill="blue"/>`; // Lötpunkt am Bauteil
            });
            // Haupt-Knotenpunkt
            if (points.length > 2) svg += `<circle cx="${centerX}" cy="${centerY}" r="3" fill="blue"/>`;
        }
    });

    return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg" style="background:#f4f4f4; border:1px solid #ccc">
        ${svg}
        <text x="10" y="20" font-family="sans-serif" font-size="12" fill="#666">Generated by Gemini + Node.js</text>
    </svg>`;
}

// Hilfsfunktion: Weiß wo die Pins bei jedem Symbol sind (lokal -> global)
function registerPins(comp, x, y, rot, wires) {
    const add = (localX, localY, net) => {
        if (!net) return;
        // Rotation berechnen
        const rad = rot * Math.PI / 180;
        const dx = localX - 25; // 25 ist mitte
        const dy = localY - 25;
        const gx = x + 25 + (dx * Math.cos(rad) - dy * Math.sin(rad));
        const gy = y + 25 + (dx * Math.sin(rad) + dy * Math.cos(rad));
        
        if (!wires[net]) wires[net] = [];
        wires[net].push({x: gx, y: gy});
    };

    const c = comp.connections;
    // Pin Mapping basierend auf Symbol-Definitionen oben
    if (['RESISTOR', 'CAPACITOR', 'INDUCTOR'].includes(comp.type)) {
        add(0, 25, c[0]);  // Links
        add(50, 25, c[1]); // Rechts
    } else if (['NMOS', 'PMOS'].includes(comp.type)) {
        add(0, 25, c[0]);  // Gate
        add(35, 10, c[1]); // Drain (oben rechts)
        add(35, 40, c[2]); // Source (unten rechts)
    } else if (comp.type === 'GND') {
        add(25, 0, c[0]);  // Oben
    } else if (comp.type === 'VCC') {
        add(25, 50, c[0]); // Unten
    } else if (comp.type === 'INPUT') {
        add(50, 25, c[0]); // Rechts raus
    } else if (comp.type === 'OUTPUT') {
        add(0, 25, c[0]);  // Links rein
    }
}

// MAIN
(async () => {
    try {
        const prompt = "Ein Common Source Amplifier with a PMOS ACTIVE laod"
        console.log("🤖 Frage Gemini:", prompt);
        
        const data = await generateCircuit(prompt);
        console.log("📋 Plan erhalten:", JSON.stringify(data, null, 2));
        
        const svg = renderSVG(data);
        fs.writeFileSync('circuit_env.svg', svg);
        console.log("✅ Datei 'circuit_env.svg' erstellt.");
        
    } catch (e) {
        console.error("Fehler:", e.message);
    }
})();