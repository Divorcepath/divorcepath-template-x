import { LoopParagraphStrategy } from 'src/plugins/sections/strategy';
import { XmlParser } from 'src/xml';
import type { Section } from 'src/plugins/sections/strategy/iLoopStrategy';

describe('LoopParagraphStrategy.mergeBack (excludable hidden)', () => {
  it('removes the section completely when hidden and excludable with no content', () => {
    const parser = new XmlParser();
    const body = parser.parse(
      '<w:body><w:p><w:r><w:t>first</w:t></w:r></w:p><w:p><w:r><w:t>last</w:t></w:r></w:p></w:body>'
    );

    const firstParagraph = body.childNodes![0];
    const lastParagraph = body.childNodes![1];

    const strategy = new LoopParagraphStrategy();

    const section: Section = {
      name: 'section1',
      hidden: true,
      hideMode: 'excludable',
    } as Section;

    // Act – merge back with no middle paragraphs (i.e., section excluded)
    strategy.mergeBack([], firstParagraph, lastParagraph, section);

    // Assert – body should have no child nodes left
    expect(body.childNodes?.length).toBe(0);
  });
}); 