/*
  THE LESSON LIST: the single place to edit when you add a lesson.

  To add a lesson:
    1. Copy templates/lesson-template.html to lessons/<id>.html
    2. Set ready:true on its entry below (the id must match the file name).
  Lessons with ready:false show as "Soon" in the sidebar and are skipped by Previous/Next.
*/
window.COURSE = {
  title: "Python, from the inside out",
  parts: [
    { title: "Getting started", lessons: [
      { id: "01-what-is-python",      title: "What is Python?",                 min: 6,  ready: false },
      { id: "02-why-python",          title: "Why Python?",                     min: 6,  ready: false },
      { id: "03-install-python",      title: "Download and install Python",     min: 10, ready: false },
      { id: "04-environment-venv",    title: "Set up your environment (venv)",  min: 12, ready: false },
      { id: "05-vscode-setup",        title: "Set up VS Code for Python",       min: 12, ready: false },
      { id: "06-your-first-code",     title: "Your first code",                 min: 20, ready: true  }
    ]},
    { title: "Under the hood", lessons: [
      { id: "07-how-python-works",    title: "How Python works",                min: 25, ready: true  }
    ]},
    { title: "The basics", lessons: [
      { id: "08-comments",            title: "Comments",                        min: 6,  ready: false },
      { id: "09-print-and-input",     title: "print() and input()",             min: 15, ready: false },
      { id: "10-special-characters",  title: "Special characters",              min: 8,  ready: false },
      { id: "11-escape-sequences",    title: "Escape sequences",                min: 10, ready: false },
      { id: "12-variables",           title: "Variables",                       min: 12, ready: false },
      { id: "13-variables-in-memory", title: "Variables in memory",             min: 20, ready: false },
      { id: "14-challenges-1",        title: "Challenge set 1",                 min: 30, ready: false }
    ]}
  ]
};
