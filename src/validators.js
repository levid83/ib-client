import { InputTypeError } from './errors'
export function validateInput(condition, errMessage) {
  if (!condition) throw new InputTypeError(errMessage)
}
