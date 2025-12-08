import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  PromptCollections,
  PromptTemplates,
  PromptVariables,
  and,
  db,
  eq,
  or,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedCollection(collectionId: string, userId: string) {
  const [collection] = await db
    .select()
    .from(PromptCollections)
    .where(and(eq(PromptCollections.id, collectionId), eq(PromptCollections.userId, userId)));

  if (!collection) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Collection not found.",
    });
  }

  return collection;
}

async function getOwnedTemplate(templateId: string, userId: string) {
  const [template] = await db
    .select()
    .from(PromptTemplates)
    .where(eq(PromptTemplates.id, templateId));

  if (!template) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Template not found.",
    });
  }

  if (template.userId !== userId) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "You do not have access to this template.",
    });
  }

  return template;
}

export const server = {
  createCollection: defineAction({
    input: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [collection] = await db
        .insert(PromptCollections)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: input.name,
          description: input.description,
          icon: input.icon,
          isDefault: input.isDefault ?? false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { collection } };
    },
  }),

  updateCollection: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        isDefault: z.boolean().optional(),
      })
      .refine(
        (input) =>
          input.name !== undefined ||
          input.description !== undefined ||
          input.icon !== undefined ||
          input.isDefault !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedCollection(input.id, user.id);

      const [collection] = await db
        .update(PromptCollections)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          updatedAt: new Date(),
        })
        .where(eq(PromptCollections.id, input.id))
        .returning();

      return { success: true, data: { collection } };
    },
  }),

  listCollections: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const collections = await db
        .select()
        .from(PromptCollections)
        .where(eq(PromptCollections.userId, user.id));

      return { success: true, data: { items: collections, total: collections.length } };
    },
  }),

  createTemplate: defineAction({
    input: z.object({
      collectionId: z.string().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      modelHint: z.string().optional(),
      promptBody: z.string().min(1),
      tags: z.string().optional(),
      isFavorite: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      if (input.collectionId) {
        await getOwnedCollection(input.collectionId, user.id);
      }

      const now = new Date();
      const [template] = await db
        .insert(PromptTemplates)
        .values({
          id: crypto.randomUUID(),
          collectionId: input.collectionId ?? null,
          userId: user.id,
          name: input.name,
          description: input.description,
          modelHint: input.modelHint,
          promptBody: input.promptBody,
          tags: input.tags,
          isFavorite: input.isFavorite ?? false,
          isSystem: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { template } };
    },
  }),

  updateTemplate: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        collectionId: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        modelHint: z.string().optional(),
        promptBody: z.string().optional(),
        tags: z.string().optional(),
        isFavorite: z.boolean().optional(),
      })
      .refine(
        (input) =>
          input.collectionId !== undefined ||
          input.name !== undefined ||
          input.description !== undefined ||
          input.modelHint !== undefined ||
          input.promptBody !== undefined ||
          input.tags !== undefined ||
          input.isFavorite !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      const template = await getOwnedTemplate(input.id, user.id);

      if (input.collectionId !== undefined && input.collectionId !== null) {
        await getOwnedCollection(input.collectionId, user.id);
      }

      const [updated] = await db
        .update(PromptTemplates)
        .set({
          ...(input.collectionId !== undefined ? { collectionId: input.collectionId } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.modelHint !== undefined ? { modelHint: input.modelHint } : {}),
          ...(input.promptBody !== undefined ? { promptBody: input.promptBody } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
          ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
          updatedAt: new Date(),
        })
        .where(eq(PromptTemplates.id, input.id))
        .returning();

      return { success: true, data: { template: updated } };
    },
  }),

  listTemplates: defineAction({
    input: z
      .object({
        favoritesOnly: z.boolean().default(false),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const favoritesOnly = input?.favoritesOnly ?? false;

      const filters = [eq(PromptTemplates.userId, user.id)];
      if (favoritesOnly) {
        filters.push(eq(PromptTemplates.isFavorite, true));
      }

      const templates = await db.select().from(PromptTemplates).where(and(...filters));

      return { success: true, data: { items: templates, total: templates.length } };
    },
  }),

  createPromptVariable: defineAction({
    input: z.object({
      templateId: z.string().min(1),
      name: z.string().min(1),
      label: z.string().optional(),
      description: z.string().optional(),
      inputType: z.string().optional(),
      defaultValue: z.string().optional(),
      optionsJson: z.string().optional(),
      orderIndex: z.number().int().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedTemplate(input.templateId, user.id);

      const [variable] = await db
        .insert(PromptVariables)
        .values({
          id: crypto.randomUUID(),
          templateId: input.templateId,
          name: input.name,
          label: input.label,
          description: input.description,
          inputType: input.inputType,
          defaultValue: input.defaultValue,
          optionsJson: input.optionsJson,
          orderIndex: input.orderIndex,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { variable } };
    },
  }),

  updatePromptVariable: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        templateId: z.string().min(1),
        name: z.string().optional(),
        label: z.string().optional(),
        description: z.string().optional(),
        inputType: z.string().optional(),
        defaultValue: z.string().optional(),
        optionsJson: z.string().optional(),
        orderIndex: z.number().int().optional(),
      })
      .refine(
        (input) =>
          input.name !== undefined ||
          input.label !== undefined ||
          input.description !== undefined ||
          input.inputType !== undefined ||
          input.defaultValue !== undefined ||
          input.optionsJson !== undefined ||
          input.orderIndex !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedTemplate(input.templateId, user.id);

      const [existing] = await db
        .select()
        .from(PromptVariables)
        .where(and(eq(PromptVariables.id, input.id), eq(PromptVariables.templateId, input.templateId)));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Prompt variable not found.",
        });
      }

      const [variable] = await db
        .update(PromptVariables)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.inputType !== undefined ? { inputType: input.inputType } : {}),
          ...(input.defaultValue !== undefined ? { defaultValue: input.defaultValue } : {}),
          ...(input.optionsJson !== undefined ? { optionsJson: input.optionsJson } : {}),
          ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
        })
        .where(eq(PromptVariables.id, input.id))
        .returning();

      return { success: true, data: { variable } };
    },
  }),

  deletePromptVariable: defineAction({
    input: z.object({
      id: z.string().min(1),
      templateId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedTemplate(input.templateId, user.id);

      const result = await db
        .delete(PromptVariables)
        .where(and(eq(PromptVariables.id, input.id), eq(PromptVariables.templateId, input.templateId)));

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Prompt variable not found.",
        });
      }

      return { success: true };
    },
  }),

  listPromptVariables: defineAction({
    input: z.object({
      templateId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedTemplate(input.templateId, user.id);

      const variables = await db
        .select()
        .from(PromptVariables)
        .where(eq(PromptVariables.templateId, input.templateId));

      return { success: true, data: { items: variables, total: variables.length } };
    },
  }),
};
