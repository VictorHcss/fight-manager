"use client";

import type { TestAccount } from "@/lib/test-accounts";

/** Contas de teste (só em desenvolvimento): um toque preenche o formulário de login. */
export function TestAccounts({ accounts, password }: { accounts: TestAccount[]; password: string }) {
  const fill = (email: string) => {
    const form = document.querySelector<HTMLFormElement>("form.auth-form");
    const emailInput = form?.querySelector<HTMLInputElement>("#email");
    const passwordInput = form?.querySelector<HTMLInputElement>("#password");
    if (!form || !emailInput || !passwordInput) return;
    emailInput.value = email;
    passwordInput.value = password;
    form.querySelector<HTMLButtonElement>("button[type=submit]")?.focus();
  };
  return (
    <section className="test-accounts" aria-labelledby="test-accounts-title">
      <h2 id="test-accounts-title">Contas de teste</h2>
      <p>Ambiente de desenvolvimento. Escolha uma conta para preencher o login (senha <code>{password}</code>).</p>
      <ul>
        {accounts.map((a) => (
          <li key={a.email}>
            <button type="button" onClick={() => fill(a.email)}>
              <strong>{a.label}</strong>
              <span>{a.email}</span>
              <small>{a.description}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
