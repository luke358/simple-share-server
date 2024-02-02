import Joi from 'joi';

export function validateSocketPayload({ type, payload }) {
  const schemaSocketPayload = Joi.object({
    type: Joi.string().required(),
  });

  const { error } = schemaSocketPayload.validate({ type, payload });
  return error || null;
}
