import {
  diaDaSemana,
  resolverData,
  DIAS_DA_SEMANA,
  VENCIMENTOS_DE_EXEMPLO,
} from "@/lib/calendario";
import { formatDateOnly } from "@/lib/format";
import type { Etapa } from "@/lib/reguas";

/**
 * Em que dia a etapa cai, para dois vencimentos concretos.
 *
 * É a demonstração do campo `contagem`, e a razão de ele existir: `D-3` não é uma data, é uma
 * conta, e em dias úteis a mesma etapa sai num dia diferente conforme o feriado do mês. Sem isto na
 * tela, âncora e contagem são dois selects que ninguém sabe se mexeu para o lado certo. O dia da
 * semana ao lado da data é o que deixa ver o fim de semana e o feriado empurrando a conta.
 */
export function QuandoCai({ etapa }: { etapa: Etapa }) {
  return (
    <div className="flex flex-col gap-1">
      {VENCIMENTOS_DE_EXEMPLO.map((vencimento) => {
        const data = resolverData(vencimento, etapa.deslocamento, etapa.contagem);

        return (
          <div key={vencimento} className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <span className="text-subtle">venc. {formatDateOnly(vencimento).slice(0, 5)}</span>
            <span className="text-foreground tabular-nums">{formatDateOnly(data).slice(0, 5)}</span>
            <span className="text-subtle">{DIAS_DA_SEMANA[diaDaSemana(data)]}</span>
          </div>
        );
      })}
    </div>
  );
}
