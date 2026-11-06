EHAN WEBSITE UPDATE

Ready for the existing gribbin746-cpu/tutoring GitHub Pages site.
Publishing was blocked by GitHub: Resource not accessible by integration (403).
No production files were changed and no test submission was emailed.

INSTALL
Upload these four files to the root of the existing repository, replacing index.html:
- index.html
- Ehan_Reading_Writing_Loop.html
- Ehan_Loop.js
- Ehan_Loop_Content.js
Keep the other existing website files. Commit to the existing main branch so GitHub Pages rebuilds.
The tests folder is optional for hosting.

BEHAVIOUR
Ehan's dashboard has two task cards: 30 word-cloze questions and his 30-minute ASAT Docix rewrite.
The reading task uses five complete published extracts, six gaps each. Each extract links to its original source.
First responses lock when marked. Missed questions show the answer, context, explanation and a multiple-choice mistake checklist. Other needs a note.
The original Docix speech is from the asat review tab of Ehan's document. His checklist is above the editor. A fixed 30-minute deadline persists through reloads; the speech then locks and checklist/self-marks become available.
Self-marks use the existing six criteria, 0–5 each, total /30, with conversational descriptions. Unticked checklist items are allowed.
Send to Hanoof uses the site's existing submitWriting endpoint. The responseText includes the rewrite, all self-marks, all checklist items, all 30 reading answers, mistake reasons/notes, explanations and source credits. Speech word count excludes the report. It will send when Ehan completes and submits, after the files are published.
Drafts and the timer are saved in the same browser. A download button provides a text backup. Unconfirmed submissions do not automatically retry.

VALIDATION
10 Node tests pass. Run: node --test tests/ehan-loop.test.cjs
Browser checks covered all 30 responses, incomplete-answer validation, mistake reasons/Other, the reading-to-writing handoff, draft recovery, post-deadline locking, checklist/rubric controls and the combined submission payload.
Browser submission checks used a mock transport and generated no production reading history or email.
Read-only live login and existing email records confirmed the existing submission route. New live email delivery has not been tested with a real student submission.

CURRICULUM
The vocabulary and context work targets NSW Stage 3 EN3-VOCAB-01 and EN3-RECOM-01. The rewrite targets audience, purpose, organisation, sentence-level grammar and word choice in EN3-CWT-01. This is an extension lesson, not an official practice paper.
https://curriculum.nsw.edu.au/learning-areas/english/english-k-10-2022/outcomes
https://education.nsw.gov.au/teaching-and-learning/curriculum/literacy-and-numeracy/teaching-and-learning-resources/literacy/teaching-strategies/stage-3/reading/stage-3-vocabulary
