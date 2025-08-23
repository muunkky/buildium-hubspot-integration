# XML Reconstruction & Validation Plan

This document outlines the methodology used to repair and validate the `residential-tenancies-act.xml` file based on the source text (`ATA.txt`) and a structural template (`alberta-act-template.xml`).

## 1. Initial Planning & Discovery

The initial goal was to ensure the XML file was a complete and well-formed representation of the source text. An early attempt to simply create the file was halted in favor of a more robust validation-first approach.

A key constraint was the need to work with a limited context window, which led to a methodical, chunk-based processing plan.

## 2. Validation Phase

This phase focused on identifying all discrepancies between the existing (but flawed) XML and the source `ATA.txt`.

- **Strategy:** The files were read and compared section by section.
- **Findings:** A number of systemic, repeating errors were discovered in the original XML.
- **TODO List:** To track these issues, a `TODO.md` file was created. Key issues logged included:
    - Mismatched document titles.
    - Incorrectly placed `<Preamble>` content.
    - Widespread missing first subsections in most sections.
    - Systemic incorrect formatting of lists (using `<Paragraph>` instead of `<ClauseList>`).
    - Jumbled and merged sections, particularly at the start and end of the document.
    - Entire missing parts (e.g., Part 7).
    - Invalid XML structure (e.g., duplicate Part tags).

## 3. Resolution Phase

Given the depth of the errors, patching the existing file was deemed too risky. A full reconstruction was performed.

- **Strategy:** A new file, `residential-tenancies-act_fixed.xml`, was created to ensure a clean result.
- **Process:**
    1. The new file was initiated with the correct XML header and metadata.
    2. The source `ATA.txt` was processed sequentially, Part by Part, and Section by Section.
    3. For each section, the correct XML structure was generated manually based on the `alberta-act-template.xml` rules, incorporating the raw text from `ATA.txt`.
    4. This process naturally corrected all the issues logged in the `TODO.md` file, from simple title mismatches to complex structural and formatting errors.
    5. The process was done in batches (first by individual sections, then by entire Parts) to balance efficiency and safety.

## 4. Final Verification

After the reconstruction was complete, a final verification pass was performed to ensure no content was dropped.

- **Strategy:** The full text of the source `ATA.txt` was compared against the full text content within the tags of the new `residential-tenancies-act_fixed.xml`.
- **Result:** The verification confirmed that all content was preserved and correctly placed.

## 5. Finalization

The final step was to replace the original, corrupted XML file with the newly created and verified version.
