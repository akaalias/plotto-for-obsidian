import { parse } from 'node-html-parser'
import 'ts-replace-all'
const inquirer = require('inquirer')

const fs = require('fs')
const root = parse(fs.readFileSync('Plotto.html'))
const json = JSON.parse(fs.readFileSync('plotto.json'));

const frontMatter = root.querySelector('.frontmatter')
const bodyList = frontMatter?.querySelectorAll('.bodylist')
const conflicts = root.querySelectorAll('.conflict')

let characters: string[] = []
let bClausesToConflictsMap = new Map<string, string[]>()
let conflictsToBClauseMap = new Map<string, string>()

function saveMarkdownFile(file: string, content: string) {
    fs.writeFile(file, content, (err: any) => {
        if (err) {
            console.error(err)
            return
        }
        //file written successfully
        console.log("Success: Wrote " + file)
    })
}
function compileBClauseIndex() {
// Index of Conflicts Grouped Under the “B” Clauses
// @ts-ignore
    for (let listItem of bodyList) {
        const links = listItem.querySelectorAll('.clink')
        if (links.length <= 0) continue

        const itemText = listItem.innerText
        const cleanedItemText = itemText.replace(/^\(\d+\)/, "")
        const bClauses = cleanedItemText.split(";")

        // Iterate over cleaned bClause list item
        for (let clause of bClauses) {
            const nameMatches = clause.match(/^\D+/)
            if (nameMatches != null && nameMatches.length > 0) {
                const clauseName = nameMatches[0].trim()
                const regexp = new RegExp(/\d+/, 'g');

                // Add clause if not yet added
                if (!bClausesToConflictsMap.has(clauseName)) {
                    var emptyConflictIDs = new Array<string>()
                    bClausesToConflictsMap.set(clauseName, emptyConflictIDs)
                }

                // Deal with the conflictIDs
                let match;
                while ((match = regexp.exec(clause)) !== null) {
                    const conflictID = match[0]

                    // Add it to bClausesToConflictsMap
                    let existingConflictIDs = bClausesToConflictsMap.get(clauseName)
                    if (existingConflictIDs != null) {
                        existingConflictIDs.push(conflictID)
                    }

                    // Add it to conflictsToBClauseMap
                    if(!conflictsToBClauseMap.has(conflictID)) {
                        conflictsToBClauseMap.set(conflictID, clauseName)
                    }

                    // console.log(conflictID + " -> " + conflictsToBClauseMap.get(conflictID))
                }
            }
        }
    }
}
function extractBClauseConflictMappings() {
    for (let bClauseEntryKey of Array.from(bClausesToConflictsMap.keys())) {
        const conflicts = bClausesToConflictsMap.get(bClauseEntryKey)

        let markdown = "## " + bClauseEntryKey + "\n"
        markdown += "### Conflicts\n"
        // @ts-ignore
        for (let conflictID of conflicts) {
            markdown += "- " + "[[" + conflictID + "]]\n"
        }

        markdown += "\n"
        markdown += "#bclause\n"
        saveMarkdownFile("./markdown/groups/" + bClauseEntryKey + ".md", markdown)
    }
}
function extractConflicts() {
// For each conflict
    for (let conflict of conflicts) {
        const conflictIdDiv = conflict.querySelector('.conflictid')
        const conflictId = conflictIdDiv?.innerText
        const prelinksDivs = conflict.querySelectorAll('.prelinks')
        const descsDivs = conflict.querySelectorAll('.desc')
        const postlinksDivs = conflict.querySelectorAll('.postlinks')
        const variantCount = prelinksDivs.length

        if (conflictId != null) {

            const outputMarkdownFileName = conflictId + ".md"
            let outputMarkdownFileContent = "## " + conflictId + "\n"

            for (var i = 0; i < variantCount; i++) {
                const preLinks = prelinksDivs[i]
                const descriptionDiv = descsDivs[i]
                const postLinks = postlinksDivs[i]
                const prelinkLinkGroup = preLinks.querySelectorAll('.clinkgroup')
                const postlinkLinkGroup = postLinks.querySelectorAll('.clinkgroup')
                const descriptionFullText = descriptionDiv.innerText
                const itemizedDescriptions = descriptionFullText.split("*")
                const subId = preLinks.querySelector('.subid')?.innerText

                if (subId != null) {
                    outputMarkdownFileContent += "### " + subId + "\n"
                }

                // Pre-Links
                outputMarkdownFileContent += "- "
                for (let linkySpan of prelinkLinkGroup) {
                    const ahref = linkySpan.querySelector('.clink')
                    const linkHref = ahref?.getAttribute('href')
                    const linkHrefToConflictId = linkHref?.replace("#", "")
                    const linkText = ahref?.innerText

                    if (linkText !== linkHrefToConflictId) {
                        outputMarkdownFileContent += "[[" + linkHrefToConflictId + " | " + linkText + "]] "
                    } else {
                        outputMarkdownFileContent += "[[" + linkHrefToConflictId + "]] "
                    }
                }
                outputMarkdownFileContent += "\n"

                // Description(s)
                for (let descPiece of itemizedDescriptions) {
                    if (descPiece == "") {
                        continue
                    }
                    descPiece = descPiece.trim()

                    for(let character of characters) {
                        descPiece = descPiece.replaceAll(character, "[[" + character + "]]")
                    }

                    outputMarkdownFileContent += "- " + descPiece + "\n"
                }

                // Post-Links
                outputMarkdownFileContent += "- "
                for (let linkySpan of postlinkLinkGroup) {
                    const ahref = linkySpan.querySelector('.clink')
                    const linkHref = ahref?.getAttribute('href')
                    const linkHrefToConflictId = linkHref?.replace("#", "")
                    const linkText = ahref?.innerText

                    if (linkText !== linkHrefToConflictId) {
                        outputMarkdownFileContent += "[[" + linkHrefToConflictId + " | " + linkText + "]] "
                    } else {
                        outputMarkdownFileContent += "[[" + linkHrefToConflictId + "]] "
                    }
                }
                outputMarkdownFileContent += "\n"
                outputMarkdownFileContent += "\n"
            }

            // Add link back to BClause
            const bClauseName = conflictsToBClauseMap.get(conflictId)

            if (bClauseName != null) {
                outputMarkdownFileContent += "\n"
                outputMarkdownFileContent += "### Group\n"
                outputMarkdownFileContent += "- [[" + bClauseName + "]]\n"
                outputMarkdownFileContent += "\n"
                outputMarkdownFileContent += "### Tags\n"
                outputMarkdownFileContent += "- #" + bClauseName?.replace(/\s/g, "") + "\n"
                outputMarkdownFileContent += "\n"
            }

            saveMarkdownFile('./markdown/Conflicts/' + outputMarkdownFileName, outputMarkdownFileContent)
        }
    }
}
function createCharacters() {

    const charactersJSON = json["characters"]

    for (const [mapKey, mapValue] of Object.entries(charactersJSON)) {
        if(mapKey == "A" || mapKey == "B") {
            continue
        }

        let markdown = "## " + mapKey + "\n"
        markdown += "- " + mapValue + "\n"
        saveMarkdownFile("./markdown/Characters/" + mapKey + ".md", markdown)

        characters.push(mapKey)
    }
}
function createAClauses() {
    for (let masterClauseA of json["masterClauseA"]) {
        let markdown = "## " + masterClauseA + "\n"
        markdown += "\n"
        markdown += "\n"
        saveMarkdownFile("./markdown/A-Clauses/" + masterClauseA + ".md", markdown)
    }
}
function createBClauses() {
    let createdGroups = new Map<string, string[]>()
    let createdSubGroups = new Map<string, string>()

    for (let masterClauseB of json["masterClauseB"]) {
        const description = masterClauseB["description"]
        const group = masterClauseB["group"]
        const subGroup = masterClauseB["subgroup"]

        let markdown = "## " + description + "\n"
        markdown += "\n"

        // Create Node
        for (let conflictID of masterClauseB["nodes"]) {
            const idString = "" + conflictID
            if (idString.match(/[a-z]/)) {
                const firstCharIdx = idString.search(/[a-z]/)
                const id = idString.substring(0, firstCharIdx)
                const char = idString.substring(firstCharIdx, idString.length)
                markdown += "- " + "[[" + id + "#" + char + "]]\n"
            } else {
                markdown += "- " + "[[" + conflictID + "]]\n"
            }
        }
        markdown += "\n"

        markdown += "### Group\n"
        markdown += "- " + "[[" + group + "]]\n"
        markdown += "\n"

        markdown += "### Subgroup\n"
        markdown += "- " + "[[" + subGroup + "]]\n"
        markdown += "\n"

        if(!createdSubGroups.has(subGroup)) {
            let subGroupMarkdown = "## " + subGroup + "\n"
            subGroupMarkdown += "\n"
            subGroupMarkdown += "### Group\n"
            subGroupMarkdown += "- [[" + group + "]]\n"
            saveMarkdownFile("./markdown/B-Clauses/Subgroups/" + subGroup + ".md", subGroupMarkdown)
            createdSubGroups.set(subGroup, subGroup)
        }

        if(!createdGroups.has(group)) {
            const groupMarkdown = "## " + group + "\n"
            saveMarkdownFile("./markdown/B-Clauses/Groups/" + group + ".md", groupMarkdown)
            createdGroups.set(group, group)
        }

        saveMarkdownFile("./markdown/B-Clauses/" + description + ".md", markdown)
    }
}
function createCClauses() {
    for (let masterClauseC of json["masterClauseC"]) {
        let markdown = "## " + masterClauseC + "\n"
        markdown += "\n"
        markdown += "\n"
        saveMarkdownFile("./markdown/C-Clauses/" + masterClauseC + ".md", markdown)
    }
}
function promptAndExecuteExport() {
    var questions = [
        {
            type: 'input',
            name: 'ready',
            message: "Ready to generate all markdown files?"
        }
    ]

    inquirer.prompt(questions).then((answers: { [x: string]: any }) => {
        console.log("Starting export")
        createCharacters()
        createAClauses()
        createBClauses();
        createCClauses()

        compileBClauseIndex()
        extractBClauseConflictMappings()
        extractConflicts()
    })
}
promptAndExecuteExport();
