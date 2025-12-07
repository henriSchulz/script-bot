export type Dictionary = typeof en;

export const en = {
  common: {
    back: "Back",
    next: "Next",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    loading: "Loading...",
    error: "Error",
    success: "Success",
  },
  project: {
    overview: "Projects",
    files: "Files",
    summaries: "Summaries",
    exercises: "Exercises",
    formulas: "Formulas",
    chat: "Chat",
    settings: "Settings",
    newProject: "New Project",
    createProject: "Create Project",
    projectName: "Project Name",
    description: "Description",
    color: "Color",
    language: "Language",
    projectChat: {
      title: "Chat with your project files",
      welcomeTitle: "How can I help with your project?",
      welcomeMessage: "I have access to all your project files. Ask me to summarize, explain, or answer questions about them.",
      placeholder: "Ask anything about your project...",
      uploadSuccess: "Uploaded files:",
      error: "Sorry, I couldn't generate a response.",
      uploadError: "Failed to upload files",
    }
  },
  files: {
    upload: "Upload Files",
    dragDrop: "Drag & drop files here, or click to select files",
    noFiles: "No files uploaded yet",
  },
  summaries: {
    generate: "Generate Summary",
    title: "Title",
    noSummaries: "No summaries yet",
  },
  exercises: {
    solve: "Solve",
    theory: "Theory",
    chat: "Chat",
    noExercises: "No exercises yet",
    chatInterface: {
      hint: "Get a Hint",
      solution: "Show Solution",
      placeholder: "Type your solution or question...",
      send: "Send",
      backToOverview: "Back to Overview",
      startJourney: "Start your journey!",
      startPrompt: "Ask a question or describe your approach",
      analyzing: "Analyzing...",
      analyze: "Analyze",
      skipMessage: "I am stuck. Please explain the solution to me step by step.",
      hintMessage: "Can you give me a subtle hint without revealing the full solution? Just point me in the right direction."
    }
  },
  formulas: {
    title: "Formulas",
    noFormulas: "No formulas yet",
  },
  ai: {
    generating: "Generating...",
    analyzing: "Analyzing...",
  },
  generateBlocks: {
    title: "Generate Content with AI",
    description: "Enter a topic or concept you want to explain. The AI will generate text, formulas, and diagrams for you.",
    topicLabel: "Topic",
    topicPlaceholder: "e.g., Newton's Second Law, Photosynthesis...",
    generate: "Generate",
    generating: "Generating...",
    success: "Content generated successfully!",
    error: "Failed to generate content"
  }
};

export const de: Dictionary = {
  common: {
    back: "Zurück",
    next: "Weiter",
    cancel: "Abbrechen",
    save: "Speichern",
    delete: "Löschen",
    edit: "Bearbeiten",
    create: "Erstellen",
    loading: "Laden...",
    error: "Fehler",
    success: "Erfolg",
  },
  project: {
    overview: "Projekte",
    files: "Dateien",
    summaries: "Zusammenfassungen",
    exercises: "Aufgaben",
    formulas: "Formelsammlung",
    chat: "Chat",
    settings: "Einstellungen",
    newProject: "Neues Projekt",
    createProject: "Projekt erstellen",
    projectName: "Projektname",
    description: "Beschreibung",
    color: "Farbe",
    language: "Sprache",
    projectChat: {
      title: "Chatte mit deinen Projektdateien",
      welcomeTitle: "Wie kann ich dir bei deinem Projekt helfen?",
      welcomeMessage: "Ich habe Zugriff auf alle deine Projektdateien. Bitte mich, sie zusammenzufassen, zu erklären oder Fragen dazu zu beantworten.",
      placeholder: "Frag etwas über dein Projekt...",
      uploadSuccess: "Hochgeladene Dateien:",
      error: "Entschuldigung, ich konnte keine Antwort generieren.",
      uploadError: "Fehler beim Hochladen der Dateien",
    }
  },
  files: {
    upload: "Dateien hochladen",
    dragDrop: "Dateien hierher ziehen oder klicken zum Auswählen",
    noFiles: "Noch keine Dateien hochgeladen",
  },
  summaries: {
    generate: "Zusammenfassung erstellen",
    title: "Titel",
    noSummaries: "Noch keine Zusammenfassungen",
  },
  exercises: {
    solve: "Lösen",
    theory: "Theorie",
    chat: "Chat",
    noExercises: "Noch keine Aufgaben",
    chatInterface: {
      hint: "Hinweis erhalten",
      solution: "Lösung anzeigen",
      placeholder: "Gib deine Lösung oder Frage ein...",
      send: "Senden",
      backToOverview: "Zurück zur Übersicht",
      startJourney: "Leg los!",
      startPrompt: "Stelle eine Frage oder beschreibe deinen Ansatz",
      analyzing: "Analysiere...",
      analyze: "Analysieren",
      skipMessage: "Ich komme nicht weiter. Bitte erkläre mir die Lösung Schritt für Schritt.",
      hintMessage: "Kannst du mir einen kleinen Hinweis geben, ohne die ganze Lösung zu verraten? Zeig mir nur die richtige Richtung."
    }
  },
  formulas: {
    title: "Formelsammlung",
    noFormulas: "Noch keine Formeln",
  },
  ai: {
    generating: "Generiere...",
    analyzing: "Analysiere...",
  },
  generateBlocks: {
    title: "Inhalt mit KI generieren",
    description: "Gib ein Thema oder Konzept ein, das du erklären möchtest. Die KI generiert Text, Formeln und Diagramme für dich.",
    topicLabel: "Thema",
    topicPlaceholder: "z.B. Newtons Zweites Gesetz, Photosynthese...",
    generate: "Generieren",
    generating: "Generiere...",
    success: "Inhalt erfolgreich generiert!",
    error: "Fehler beim Generieren des Inhalts"
  }
};

export const dictionaries = { en, de };
