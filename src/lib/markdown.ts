import TurndownService from 'turndown';

export function createTurndownService(): TurndownService {
  const td = new TurndownService({ headingStyle: 'atx' });
  td.addRule('pageBreak', {
    filter: (node) => node.nodeName === 'SPAN' && node.classList.contains('page-break'),
    replacement: () => '\n\n---\n\n'
  });
  return td;
}
