export type CatalogDish = {
  id: string; sourceIds: string[]; ingredients: string[]; ar: string; en: string; category: string; channels: string[];
  image: string | null; calories: number | null; protein: number | null; carbs: number | null; fats: number | null;
};
export function isCatalogDish(row: any): boolean;
export function catalogCategory(row: any): string;
export function buildCatalog(rows: any[], options: {
  imageFor: (group: any[], representative: any) => string | null;
  ingredientsFor: (group: any[], representative: any) => string[];
}): CatalogDish[];
