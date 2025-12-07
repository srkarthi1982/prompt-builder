/**
 * Prompt Builder - design reusable AI prompts with variables.
 *
 * Design goals:
 * - Core entity: PromptTemplate (with description and raw template text).
 * - Support placeholders/variables and tag them.
 * - Allow organizing templates into collections/categories.
 */

import { defineTable, column, NOW } from "astro:db";

export const PromptCollections = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    name: column.text(),                               // e.g. "Coding helpers", "Marketing prompts"
    description: column.text({ optional: true }),
    icon: column.text({ optional: true }),
    isDefault: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const PromptTemplates = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    collectionId: column.text({
      references: () => PromptCollections.columns.id,
      optional: true,
    }),
    userId: column.text(),
    name: column.text(),                               // short label
    description: column.text({ optional: true }),
    modelHint: column.text({ optional: true }),        // e.g. "chat", "image", "code", etc.
    promptBody: column.text(),                         // template text with {{variables}}
    tags: column.text({ optional: true }),             // comma-separated or JSON
    isFavorite: column.boolean({ default: false }),
    isSystem: column.boolean({ default: false }),      // future: global templates
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const PromptVariables = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    templateId: column.text({
      references: () => PromptTemplates.columns.id,
    }),
    name: column.text(),                               // e.g. "topic", "tone", "audience"
    label: column.text({ optional: true }),            // friendly label for UI
    description: column.text({ optional: true }),
    inputType: column.text({ optional: true }),        // "text", "select", "multiline", etc.
    defaultValue: column.text({ optional: true }),
    optionsJson: column.text({ optional: true }),      // JSON for select options
    orderIndex: column.number({ optional: true }),
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  PromptCollections,
  PromptTemplates,
  PromptVariables,
} as const;
