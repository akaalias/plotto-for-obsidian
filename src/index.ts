import { parse } from 'node-html-parser'
import 'ts-replace-all'

const inquirer = require('inquirer')
const fs = require('fs')
const htmlRoot = parse(fs.readFileSync('Plotto.html'))
const jsonRoot = JSON.parse(fs.readFileSync('plotto.json'));
const conflicts = htmlRoot.querySelectorAll('.conflict')

let characters: string[] = []
let bClauseIDToBClause = new Map<number, string>()

let conflictToBClauseMap = new Map<string, string>()
let conflictToGroupMap = new Map<string, string>()
let conflictToSubGroupMap = new Map<string, string>()

let bClauseToConflictsMap = new Map<string, string[]>()
let groupsToConflictsMap =  new Map<string, string[]>()
let groupsToSubgroupsMap =  new Map<string, string[]>()
let subgroupsToConflictsMap =  new Map<string, string[]>()

// Relationships
function createBClausesMapping() {
    let clauseID = 1
    for (let masterClauseB of jsonRoot["masterClauseB"]) {
        const description = masterClauseB["description"]

        // Save mapping ID to description
        bClauseIDToBClause.set(clauseID, description);
        clauseID += 1
    }
}
function createRelationships() {
    const conflictsRaw = jsonRoot["conflicts"]
    let conflictArray = []
    for(let id in conflictsRaw) {
        conflictArray.push(jsonRoot["conflicts"][id])
    }

    for (let conflict of conflictArray) {
        // @ts-ignore
        const conflictID = conflict["conflictid"]
        // @ts-ignore
        const group = conflict["group"]
        // @ts-ignore
        const subgroup = conflict["subgroup"]
        // @ts-ignore
        const bclauseID = conflict["bclause"]
        // @ts-ignore
        const bClause = bClauseIDToBClause.get(bclauseID)

        let theConflictIDCleaned = cleanUpConflictID(conflictID)

        createConflictRelationshipMaps(theConflictIDCleaned, bClause, group, subgroup)
        createBClauseRelationships(bClause, theConflictIDCleaned)
        createGroupRelationships(group, theConflictIDCleaned)
        createSubgroupRelationships(subgroup, theConflictIDCleaned)
        createGroupSubgroupRelationships(group, subgroup);
    }
}
function createGroupSubgroupRelationships(group: string, subgroup: string) {
    if(subgroup == "") { return }

    if (!groupsToSubgroupsMap.has(group)) {
        groupsToSubgroupsMap.set(group, [])
    }

    // @ts-ignore
    if (groupsToSubgroupsMap.get(group).indexOf(subgroup) < 0) {
        // @ts-ignore
        groupsToSubgroupsMap.get(group).push(subgroup)
    }
}
function createConflictRelationshipMaps(conflictID: any, bClause: string | undefined, group: any, subgroup: any) {
    if (!conflictToBClauseMap.has(conflictID)) {
        if (bClause != null) {
            conflictToBClauseMap.set(conflictID, bClause)
        }
    }

    if (!conflictToGroupMap.has(conflictID)) {
        conflictToGroupMap.set(conflictID, group)
    }

    if (!conflictToSubGroupMap.has(conflictID)) {
        conflictToSubGroupMap.set(conflictID, subgroup)
    }
}
function createBClauseRelationships(bClause: string | undefined, conflictID: any) {
    // B-Clause -> Conflicts
    if (!bClauseToConflictsMap.has(<string>bClause)) {
        if (bClause != null) {
            bClauseToConflictsMap.set(bClause, [])
        }
    }

    if (bClause != null) {
        // console.log(bClause + " -> [..." + conflictID + "...]")
        // @ts-ignore
        bClauseToConflictsMap.get(bClause).push(conflictID)
    }
}
function createGroupRelationships(group: any, theConflictIDCleaned: string) {
    if (!groupsToConflictsMap.has(group)) {
        groupsToConflictsMap.set(group, [])
    }
    // @ts-ignore
    groupsToConflictsMap.get(group).push(theConflictIDCleaned)
}
function createSubgroupRelationships(subgroup: any, theConflictIDCleaned: string) {
    if (!subgroupsToConflictsMap.has(subgroup)) {
        subgroupsToConflictsMap.set(subgroup, [])
    }

    // @ts-ignore
    subgroupsToConflictsMap.get(subgroup).push(theConflictIDCleaned)
}
function cleanUpConflictID(conflictID: any) {
    const conflictIDString = "" + conflictID
    let theConflictIDCleaned = conflictIDString
    let hash = ""

    if (conflictIDString.match(/[a-z]/)) {
        const firstCharIdx = conflictIDString.search(/[a-z]/)
        theConflictIDCleaned = conflictIDString.substring(0, firstCharIdx + 1)
        theConflictIDCleaned = theConflictIDCleaned.replaceAll(/[a-z]/g, "")
        hash = conflictIDString.substring(firstCharIdx, conflictIDString.length)
    }
    return theConflictIDCleaned;
}

// File Creation
function createConflictFiles() {
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
                outputMarkdownFileContent += "- Previous: "
                for (let linkySpan of prelinkLinkGroup) {
                    const ahref = linkySpan.querySelector('.clink')
                    const linkHref = ahref?.getAttribute('href')
                    const linkHrefToConflictId = linkHref?.replace("#", "")
                    const linkText = ahref?.innerText

                    // @ts-ignore
                    if(linkHrefToConflictId == null) { continue}

                    if (linkText !== linkHrefToConflictId) {
                        outputMarkdownFileContent += "[[" + linkHrefToConflictId + " | " + linkText + "]] "
                    } else {
                        outputMarkdownFileContent += "[[" + linkHrefToConflictId + "]] "
                    }
                }
                outputMarkdownFileContent += "\n"

                // Description(s)
                for (let descPiece of itemizedDescriptions) {
                    if (descPiece.trim() == "") {

                    } else {
                        descPiece = descPiece.trim()

                        for(let character of characters) {
                            if(character == "X") { continue }
                            descPiece = descPiece.replaceAll(character, "[[" + character + "]]")
                        }

                        outputMarkdownFileContent += "- " + descPiece + "\n"
                    }
                }

                // Post-Links
                outputMarkdownFileContent += "- Next: "
                for (let linkySpan of postlinkLinkGroup) {
                    const ahref = linkySpan.querySelector('.clink')
                    const linkHref = ahref?.getAttribute('href')
                    const linkHrefToConflictId = linkHref?.replace("#", "")
                    const linkText = ahref?.innerText

                    // @ts-ignore
                    if(linkHrefToConflictId == null) { continue}

                    if (linkText !== linkHrefToConflictId) {
                        outputMarkdownFileContent += "[[" + linkHrefToConflictId + " | " + linkText + "]] "
                    } else {
                        outputMarkdownFileContent += "[[" + linkHrefToConflictId + "]] "
                    }
                }
                outputMarkdownFileContent += "\n"
                outputMarkdownFileContent += "\n"
            }

            // Related B-Clause
            const bClause = conflictToBClauseMap.get(conflictId)
            if(bClause) {
                outputMarkdownFileContent += "## B Clause\n"
                outputMarkdownFileContent += "- " + bClause + "\n"
                outputMarkdownFileContent += "\n"
            }

            const group = conflictToGroupMap.get(conflictId)
            if(group) {
                outputMarkdownFileContent += "## Group\n"
                outputMarkdownFileContent += "- " + group + "\n"
                outputMarkdownFileContent += "\n"
            }

            const subgroup = conflictToSubGroupMap.get(conflictId)
            if(subgroup) {
                outputMarkdownFileContent += "### Subgroup\n"
                outputMarkdownFileContent += "- " + subgroup + "\n"
                outputMarkdownFileContent += "\n"
            }

            saveMarkdownFile('./markdown/Conflicts/' + outputMarkdownFileName, outputMarkdownFileContent)
        }
    }
}
function createCharacterFiles() {

    const charactersJSON = jsonRoot["characters"]

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
function createAClauseFiles() {
    for (let masterClauseA of jsonRoot["masterClauseA"]) {
        let markdown = "## " + masterClauseA + "\n"
        markdown += "\n"
        markdown += "\n"
        saveMarkdownFile("./markdown/A-Clauses/" + masterClauseA + ".md", markdown)
    }
}
function createBClauseFiles() {

    for (let masterClauseB of jsonRoot["masterClauseB"]) {
        const description = masterClauseB["description"]
        const group = masterClauseB["group"]
        const subGroup = masterClauseB["subgroup"]

        let markdown = "## " + description + "\n"
        markdown += "\n"

        // Create links to conflicts using their IDs
        for (let conflictID of masterClauseB["nodes"]) {

            // let's see if there's a hash in there or not
            const idString = "" + conflictID
            let id = idString
            let hash = ""

            if (idString.match(/[a-z]/)) {
                const firstCharIdx = idString.search(/[a-z]/)
                id = idString.substring(0, firstCharIdx)
                hash = idString.substring(firstCharIdx, idString.length)
            }

            if(hash != "") {
                markdown += "- " + "[[" + id + "#" + hash + "]]\n"
            } else {
                markdown += "- " + "[[" + id + "]]\n"
            }
        }

        markdown += "\n"

        markdown += "### Group\n"
        markdown += "- " + "[[" + group + "]]\n"
        markdown += "\n"

        markdown += "### Subgroup\n"
        markdown += "- " + "[[" + subGroup + "]]\n"
        markdown += "\n"

        saveMarkdownFile("./markdown/B-Clauses/" + description + ".md", markdown)
    }
}
function createGroupFiles() {
    for (let masterClauseB of jsonRoot["masterClauseB"]) {
        const group = masterClauseB["group"]
        const subgroups = groupsToSubgroupsMap.get(group)

        let groupMarkdown = "## " + group + "\n"
        // @ts-ignore
        if(subgroups != null) {
            for(let subgroup of subgroups) {
                groupMarkdown += "- [[" + subgroup + "]]\n"
            }
        }

        saveMarkdownFile("./markdown/Groups/" + group + ".md", groupMarkdown)
    }
}
function createSubgroupFiles() {
    for (let masterClauseB of jsonRoot["masterClauseB"]) {
        const subgroup = masterClauseB["subgroup"]
        const subgroupConflicts = subgroupsToConflictsMap.get(subgroup)
        let groupMarkdown = "## " + subgroup + "\n"

        // Only show conflicts once
        let seenConflictIDs = new Map<string, string>()
        // @ts-ignore
        for(let conflictID of subgroupConflicts) {
            if(seenConflictIDs.has(conflictID)) { continue }
            groupMarkdown += "- [[" + conflictID + "]]\n"
            seenConflictIDs.set(conflictID, conflictID)
        }

        saveMarkdownFile("./markdown/Subgroups/" + subgroup + ".md", groupMarkdown)
    }
}
function createCClauseFiles() {
    for (let masterClauseC of jsonRoot["masterClauseC"]) {
        let markdown = "## " + masterClauseC + "\n"
        markdown += "\n"
        markdown += "\n"
        saveMarkdownFile("./markdown/C-Clauses/" + masterClauseC + ".md", markdown)
    }
}
function saveMarkdownFile(file: string, content: string) {
    fs.writeFile(file, content, (err: any) => {
        if (err) {
            console.error(err)
            return
        }
    })
}

// Prompt
function promptAndExecuteExport() {
    var questions = [
        {
            type: 'input',
            name: 'ready',
            message: "Ready to generate all markdown files?"
        }
    ]

    inquirer.prompt(questions).then(async (answers: { [x: string]: any }) => {

        createBClausesMapping()
        createRelationships()
        createCharacterFiles()
        createAClauseFiles()
        createBClauseFiles()
        createGroupFiles()
        createSubgroupFiles()
        createCClauseFiles()
        createConflictFiles()
    })
}

promptAndExecuteExport();
