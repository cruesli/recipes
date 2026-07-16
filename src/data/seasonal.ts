// Month-keyed Nordic produce lists (index 0 = January). Pure data — edit freely.
export const SEASONAL_BY_MONTH: string[][] = [
  ['Kale', 'Jerusalem artichokes', 'Parsnips', 'Blood oranges'],          // Jan
  ['Kale', 'Celeriac', 'Leeks', 'Blood oranges'],                         // Feb
  ['Wild garlic', 'Leeks', 'Purple sprouting broccoli', 'Rhubarb'],       // Mar
  ['Wild garlic', 'Rhubarb', 'Radishes', 'Spring onions'],                // Apr
  ['Asparagus', 'Rhubarb', 'Radishes', 'New potatoes'],                   // May
  ['Strawberries', 'Asparagus', 'New potatoes', 'Peas', 'Radishes'],      // Jun
  ['Strawberries', 'Cherries', 'Peas', 'Broad beans', 'New potatoes'],    // Jul
  ['Chanterelles', 'Bilberries', 'Tomatoes', 'Plums', 'Sweetcorn'],       // Aug
  ['Apples', 'Plums', 'Chanterelles', 'Beetroot'],                        // Sep
  ['Pumpkin', 'Apples', 'Pears', 'Brussels sprouts'],                     // Oct
  ['Kale', 'Brussels sprouts', 'Celeriac', 'Pears'],                      // Nov
  ['Kale', 'Red cabbage', 'Clementines', 'Walnuts'],                      // Dec
];

export const SEASON_LABEL = 'In season';

export const seasonalFor = (month: number): string[] =>
  SEASONAL_BY_MONTH[month] ?? [];

// Build-time default; the splash script re-derives it client-side so the line
// stays current even when the site hasn't been rebuilt for a while.
export const SEASONAL_ITEMS = seasonalFor(new Date().getMonth());
