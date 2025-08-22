const fs = require('fs');
const xmljs = require('xml-js');

function parseTextToXml(inputText, templateXml) {
    let act = JSON.parse(xmljs.xml2json(templateXml, { compact: true, spaces: 4 }));

    // Clear existing template data
    act.Act.Metadata = {};
    act.Act.Preamble = {};
    act.Act.TableOfContents = {};
    act.Act.Body = {};
    act.Act.EnactmentDetails = {};

    const lines = inputText.split(/\r?\n/);

    // Metadata
    const title = lines.find(line => line.match(/^[A-Z\s]+ ACT$/));
    const chapter = lines.find(line => line.match(/^Chapter [A-Z0-9‑.]+$/));
    act.Act.Metadata.Title = { _text: title ? title.replace(' ACT', '') : 'GENERIC_ACT_TITLE' };
    act.Act.Metadata.Chapter = { _text: chapter ? chapter.replace('Chapter ', '') : 'GENERIC_CHAPTER_NUMBER' };
    act.Act.Metadata.DateEnacted = { _text: 'YYYY-MM-DD' }; // Placeholder
    act.Act.Metadata.LegislativeBody = { _text: 'Legislative Assembly of Alberta' };


    // Preamble
    const preambleText = lines.find(line => line.includes('HER MAJESTY'));
    act.Act.Preamble.Paragraph = { _text: preambleText || 'Preamble placeholder.' };

    // Table of Contents
    const tocStartIndex = lines.findIndex(line => line.trim() === 'Table of Contents');
    const tocEndIndex = lines.findIndex(line => line.includes('HER MAJESTY'));
    const tocLines = lines.slice(tocStartIndex + 1, tocEndIndex).filter(line => line.trim() !== '');

    act.Act.TableOfContents.SectionRef = [];
    act.Act.TableOfContents.PartRef = [];

    let currentPart = null;
    for (let i = 0; i < tocLines.length; i++) {
        const line = tocLines[i];
        if (line.startsWith('Part ')) {
            const partMatch = line.match(/^Part (\d+(\.\d+)?)\s*(.*)$/);
            if (partMatch) {
                const partTitle = tocLines[++i];
                currentPart = {
                    _attributes: { number: partMatch[1], title: partTitle.trim() },
                    SectionRef: []
                };
                act.Act.TableOfContents.PartRef.push(currentPart);
            }
        } else {
            const sectionMatch = line.trim().match(/^(\d+(\.\d+)?)\s+(.*)$/);
            if (sectionMatch) {
                const sectionRef = { _attributes: { number: sectionMatch[1], title: sectionMatch[3].trim() } };
                if (currentPart) {
                    currentPart.SectionRef.push(sectionRef);
                } else {
                    act.Act.TableOfContents.SectionRef.push(sectionRef);
                }
            }
        }
    }

    // Body Parsing
    const bodyStartIndex = tocEndIndex + 1;
    const bodyText = lines.slice(bodyStartIndex).join('\n');
    const sections = bodyText.split(/\n(?=[A-Z][a-z]+.*\n\n\d+\(\d+\))/g); // Heuristic to split sections

    act.Act.Body.Section = [];
    act.Act.Body.Part = [];

    let bodyCurrentPart = null;

    for (const sectionText of sections) {
        const sectionLines = sectionText.split(/\r?\n/);
        const titleLine = sectionLines[0].trim();
        const sectionNumberMatch = sectionLines.find(l => l.match(/^\d+\(/));
        const sectionNumber = sectionNumberMatch ? sectionNumberMatch.match(/^(\d+)/)[1] : '';

        if (titleLine.startsWith('Part ')) {
             const partMatch = titleLine.match(/^Part (\d+(\.\d+)?)\s*(.*)$/);
             if(partMatch) {
                bodyCurrentPart = {
                    _attributes: { number: partMatch[1], title: partMatch[3].trim() },
                    Section: []
                };
                act.Act.Body.Part.push(bodyCurrentPart);
             }
        } else {
            const section = {
                _attributes: { number: sectionNumber, title: titleLine },
                Subsection: [] // Placeholder for subsections
            };

            // Basic subsection parsing
            const subsectionRegex = /^\s*\((\d+)\)\s*(.*)/;
            let currentSubsection = null;
            for (const line of sectionLines) {
                const match = line.match(subsectionRegex);
                if (match) {
                    currentSubsection = {
                        _attributes: { number: match[1] },
                        Paragraph: { _text: match[2] }
                    };
                    section.Subsection.push(currentSubsection);
                } else if (currentSubsection) {
                    // This is a continuation of the previous paragraph
                    currentSubsection.Paragraph._text += ' ' + line.trim();
                }
            }

            if (bodyCurrentPart) {
                bodyCurrentPart.Section.push(section);
            } else {
                act.Act.Body.Section.push(section);
            }
        }
    }

    return xmljs.json2xml(JSON.stringify(act), { compact: true, spaces: 4 });
}

try {
    const ataText = fs.readFileSync('ATA.txt', 'utf8');
    const templateXml = fs.readFileSync('alberta-act-template.xml', 'utf8');
    
    const finalXml = parseTextToXml(ataText, templateXml);
    
    fs.writeFileSync('residential-tenancies-act.xml', finalXml);
    
    console.log('Successfully parsed ATA.txt and generated residential-tenancies-act.xml');

} catch (error) {
    console.error('An error occurred:', error);
}