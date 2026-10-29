/*
  THE LESSON LIST: the single place to edit when you add a page.

  To add a page:
    1. Copy templates/lesson-template.html to lessons/<id>.html
    2. Add an entry below (the id must match the file name and the data-lesson on <body>).
  Entries with ready:false show as "Soon" and are skipped by Previous/Next.
*/
window.COURSE = {
  title: "Python refresher",
  parts: [
    { title: "Getting started", lessons: [
      { id: "01-python-in-10-minutes",     title: "Python in 10 minutes",         min: 10, ready: true },
      { id: "02-install-and-setup",        title: "Install and set up",           min: 10, ready: true },
      { id: "03-first-program",            title: "Your first program",           min: 10, ready: true }
    ]},
    { title: "The basics", lessons: [
      { id: "04-output-input-comments",    title: "Output, input and comments",   min: 10, ready: true },
      { id: "05-text-essentials",          title: "Text essentials",              min: 10, ready: true },
      { id: "06-variables",                title: "Variables",                    min: 10, ready: true },
      { id: "07-challenge-set",            title: "Challenge set",                min: 15, ready: true }
    ]},
    { title: "Data and memory", lessons: [
      { id: "08-mutable-and-immutable",    title: "Mutable and immutable",        min: 10, ready: true },
      { id: "09-data-types",               title: "Data types: the big picture",  min: 10, ready: true },
      { id: "10-memory-and-garbage-collection", title: "Memory and garbage collection", min: 10, ready: true }
    ]},
    { title: "Data types in depth", lessons: [
      { id: "11-numbers-in-depth",         title: "Numbers in depth",             min: 10, ready: true },
      { id: "12-strings-in-depth",         title: "Strings in depth",             min: 10, ready: true },
      { id: "13-lists-and-tuples",         title: "Lists and tuples",             min: 10, ready: true },
      { id: "14-dictionaries",             title: "Dictionaries",                 min: 10, ready: true }
    ]}
  ]
};
