# SkillTrixa — Commercial Proposal

**Share this file:** `SkillTrixa-Commercial-Proposal.pdf`

46-page landscape pitch (16:9). Overview, then a **Vendor admin** chapter (red) covering every test type, then a **Student panel** chapter (blue) with opened exams (coding, aptitude, MCQ, mixed, theory, SQL, English, system design, projects, live interview), then commercials. Live screenshots from [test.skilltrixa.com](https://test.skilltrixa.com), shown full-frame (not cropped).

- Platform licence: **₹399 / student / year** (GST extra)
- If any test uses AI, **that cost is paid by the vendor**

`index.html` is the print master used to regenerate the PDF. Do not send the HTML as the proposal.

Regenerate:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="SkillTrixa-Commercial-Proposal.pdf" \
  --virtual-time-budget=25000 \
  "file:///Volumes/Main/CODING%20PLATFORM/proposal/index.html"
```
