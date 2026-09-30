import { Field } from "./ui";

/** Campos de endereço (academia, aluno e responsável). Todos opcionais. */
export function AddressFields({ values = {}, errors = {}, prefix = "" }: { values?: Record<string, string | null | undefined>; errors?: Record<string, string>; prefix?: string }) {
  const f = (name: string) => ({ id: `${prefix}${name}`, name, defaultValue: values[name] ?? "" });
  return (
    <div className="form-grid address">
      <Field label="CEP" name={`${prefix}zip`} error={errors.zip}><input {...f("zip")} inputMode="numeric" placeholder="35010-000" autoComplete="postal-code" /></Field>
      <Field label="Rua" name={`${prefix}street`} error={errors.street}><input {...f("street")} autoComplete="address-line1" /></Field>
      <Field label="Número" name={`${prefix}number`} error={errors.number}><input {...f("number")} /></Field>
      <Field label="Complemento" name={`${prefix}complement`} error={errors.complement}><input {...f("complement")} /></Field>
      <Field label="Bairro" name={`${prefix}district`} error={errors.district}><input {...f("district")} /></Field>
      <Field label="Cidade" name={`${prefix}city`} error={errors.city}><input {...f("city")} autoComplete="address-level2" /></Field>
      <Field label="UF" name={`${prefix}state`} error={errors.state}><input {...f("state")} maxLength={2} style={{ textTransform: "uppercase" }} autoComplete="address-level1" /></Field>
    </div>
  );
}

export function formatAddress(a: { street?: string | null; number?: string | null; complement?: string | null; district?: string | null; city?: string | null; state?: string | null; zip?: string | null }) {
  const line1 = [a.street, a.number].filter(Boolean).join(", ");
  const parts = [line1 + (a.complement ? ` (${a.complement})` : ""), a.district, [a.city, a.state].filter(Boolean).join("/"), a.zip].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
