import type { z } from "zod";
import { searchResultSchema, searchResultsSchema, globalSearchInputSchema } from "./search.schema";

export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchResults = z.infer<typeof searchResultsSchema>;
export type GlobalSearchInput = z.infer<typeof globalSearchInputSchema>;
