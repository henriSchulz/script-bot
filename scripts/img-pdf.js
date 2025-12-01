const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- Konfiguration ---
const originalPdf = 'beispiel.pdf';
const outputDir = './extrahierte_bilder';
const tempRepairedPdf = 'temp_repaired.pdf';

// Hilfsfunktion: Befehl ausführen
function runCommand(command) {
    try {
        execSync(command, { stdio: 'pipe' }); // 'pipe' fängt Output ab, damit wir ihn prüfen können
        return true;
    } catch (e) {
        return false;
    }
}

// Hilfsfunktion: Zählen, wie viele Dateien im Ordner sind
function countFiles(dir) {
    if (!fs.existsSync(dir)) return 0;
    // Wir zählen nur Dateien, die nicht mit '.' anfangen (versteckte Systemdateien ignorieren)
    return fs.readdirSync(dir).filter(file => !file.startsWith('.')).length;
}

// Hilfsfunktion: Ordner leeren (für sauberen Neustart)
function cleanDirectory(dir) {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => fs.unlinkSync(path.join(dir, file)));
    }
}

function smartExtract() {
    // 1. Ordner vorbereiten
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    // Wir leeren den Ordner vorher nicht zwingend, aber es wäre sauberer. 
    // Hier lassen wir es, falls du manuell was drin hast.
    
    const outputPath = path.join(outputDir, 'img');
    
    console.log("--- Versuch 1: Direkte Extraktion ---");
    runCommand(`pdfimages -all "${originalPdf}" "${outputPath}"`);

    // Check: Haben wir Dateien?
    let fileCount = countFiles(outputDir);
    
    if (fileCount > 0) {
        console.log(`✅ Erfolg! ${fileCount} Bilder extrahiert.`);
        return;
    }

    console.log("⚠️  Keine Bilder gefunden (oder PDF beschädigt).");
    console.log("--- Starte Intensiv-Reparatur (Ghostscript) ---");

    try {
        // Ghostscript: PDF neu schreiben (repariert Struktur)
        const gsCommand = `gs -o "${tempRepairedPdf}" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress "${originalPdf}"`;
        runCommand(gsCommand);

        console.log("--- Versuch 2: Extraktion aus reparierter Datei ---");
        
        // Erneuter Versuch
        runCommand(`pdfimages -all "${tempRepairedPdf}" "${outputPath}"`);
        
        // Erneuter Check
        fileCount = countFiles(outputDir);
        
        if (fileCount > 0) {
            console.log(`✅ Fertig! ${fileCount} Bilder im zweiten Anlauf gefunden.`);
        } else {
            console.log("❌ Ergebnis: Auch nach der Reparatur ist der Ordner leer.");
            console.log("   Grund: Wahrscheinlich enthält das PDF nur Vektorgrafiken (Linien/Text) und keine Pixel-Bilder.");
        }

    } catch (e) {
        console.error("❌ Fehler bei der Reparatur:", e.message);
    } finally {
        if (fs.existsSync(tempRepairedPdf)) fs.unlinkSync(tempRepairedPdf);
    }
}

smartExtract();