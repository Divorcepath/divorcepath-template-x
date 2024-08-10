import { PathPart, ScopeData, Tag, TemplateContext } from "../../compilation";
// import { TemplateData } from '../../templateData';
import { last } from "../../utils";
import { XmlNode } from "../../xml";
import { PluginUtilities, TemplatePlugin } from "../templatePlugin";
import { SectionContent } from "./sectionContent";
import {
    ILoopStrategy,
    LoopListStrategy,
    LoopParagraphStrategy,
} from "./strategy";

export const SECTIONS_CONTENT_TYPE = "sections";

export class SectionsPlugin extends TemplatePlugin {
    public readonly contentType = SECTIONS_CONTENT_TYPE;

    private readonly loopStrategies: ILoopStrategy[] = [
        new LoopListStrategy(),
        new LoopParagraphStrategy(), // the default strategy
    ];

    public setUtilities(utilities: PluginUtilities): void {
        this.utilities = utilities;
        this.loopStrategies.forEach((strategy) =>
            strategy.setUtilities(utilities)
        );
    }

    public async containerTagReplacements(
        tags: Tag[],
        data: ScopeData,
        context: TemplateContext
    ): Promise<void> {
        const value = data.getScopeData<SectionContent>();
        const section = value?.section;

        // Check if the section should be included
        if (section.include === false) {
            // If include is false, remove the section entirely
            const openTag = tags[0];
            const closeTag = last(tags);
            XmlNode.removeNodesBetween(openTag.xmlNode, closeTag.xmlNode);
            return;
        }

        // vars
        const openTag = tags[0];
        const closeTag = last(tags);

        const loopStrategy = this.loopStrategies[1];

        // prepare to loop
        const { firstNode, nodesToRepeat, lastNode } = loopStrategy.splitBefore(
            openTag,
            closeTag
        );

        // Update this line to ensure a positive integer
        const repeatCount = Math.max(1, Math.floor(+(section.include ?? 1)));
        const repeatedNodes = this.repeat(nodesToRepeat, repeatCount);

        // recursive compilation
        const compiledNodes = await this.compile(
            false,
            repeatedNodes,
            data,
            context
        );

        // merge back to the document
        loopStrategy.mergeBack(compiledNodes, firstNode, lastNode, section);
    }

    private repeat(nodes: XmlNode[], times: number): XmlNode[][] {
        if (!nodes.length || !times) return [];

        const allResults: XmlNode[][] = [];

        for (let i = 0; i < times; i++) {
            const curResult = nodes.map((node) =>
                XmlNode.cloneNode(node, true)
            );
            allResults.push(curResult);
        }

        return allResults;
    }

    private async compile(
        isCondition: boolean,
        nodeGroups: XmlNode[][],
        data: ScopeData,
        context: TemplateContext
    ): Promise<XmlNode[][]> {
        const compiledNodeGroups: XmlNode[][] = [];

        // compile each node group with it's relevant data
        for (let i = 0; i < nodeGroups.length; i++) {
            // create dummy root node
            const curNodes = nodeGroups[i];
            const dummyRootNode = XmlNode.createGeneralNode("dummyRootNode");
            curNodes.forEach((node) =>
                XmlNode.appendChild(dummyRootNode, node)
            );

            // compile the new root
            const conditionTag = this.updatePathBefore(isCondition, data, i);
            await this.utilities.compiler.compile(dummyRootNode, data, context);
            this.updatePathAfter(isCondition, data, conditionTag);

            // disconnect from dummy root
            const curResult: XmlNode[] = [];
            while (
                dummyRootNode.childNodes &&
                dummyRootNode.childNodes.length
            ) {
                const child = XmlNode.removeChild(dummyRootNode, 0);
                curResult.push(child);
            }
            compiledNodeGroups.push(curResult);
        }

        return compiledNodeGroups;
    }

    private updatePathBefore(
        isCondition: boolean,
        data: ScopeData,
        groupIndex: number
    ): PathPart {
        // if it's a condition - don't go deeper in the path
        // (so we need to extract the already pushed condition tag)
        if (isCondition) {
            if (groupIndex > 0) {
                // should never happen - conditions should have at most one (synthetic) child...
                throw new Error(
                    `Internal error: Unexpected group index ${groupIndex} for boolean condition at path "${data.pathString()}".`
                );
            }
            return data.pathPop();
        }

        // else, it's an array - push the current index
        data.pathPush(groupIndex);
        return null;
    }

    private updatePathAfter(
        isCondition: boolean,
        data: ScopeData,
        conditionTag: PathPart
    ): void {
        // reverse the "before" path operation
        if (isCondition) {
            data.pathPush(conditionTag);
        } else {
            data.pathPop();
        }
    }
}
