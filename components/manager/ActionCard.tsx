import { ChevronRightIcon } from "@/components/icons";
import { NeonPanel, SpinnerIcon, toneVars, type NeonRim, type NeonTone } from "@/components/neon";
import { ActionGlyph, type ActionGlyphKind } from "@/components/scenes/ManageKeyScene";

/**
 * One of the four key actions as a glass card: the glyph on its little
 * pedestal, the name and what it does, a chevron. The whole card is the
 * button, so the panel keeps its hover lift and rotating rim while the
 * press shrinks only the content inside it.
 */
export function ActionCard({
  glyph,
  rim,
  tone,
  title,
  hint,
  busy,
  disabled,
  onClick,
}: {
  glyph: ActionGlyphKind;
  rim: NeonRim;
  tone: NeonTone;
  title: string;
  hint: string;
  /** This card's request is the one in flight. */
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    // The panel sheds all its padding (sm:p-5 included, which p-0 alone
    // leaves in place) so the button is the whole card: hover lift and
    // click cover the same area. The glyph and type size off the card's
    // own width, since four columns at the low end of 2xl are narrower
    // than two columns on a tablet.
    <NeonPanel
      size="md"
      rim={rim}
      static={disabled}
      className="@container/card p-0 sm:p-0"
      style={toneVars(tone)}
    >
      <button
        type="button"
        disabled={disabled}
        aria-busy={busy}
        onClick={onClick}
        className="group/action relative z-[1] flex w-full cursor-pointer items-center gap-3 rounded-[20px] py-2.5 pr-4 pl-3 text-left outline-none transition-[scale,opacity] duration-200 ease-smooth focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tone-hi))] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 @min-[380px]/card:gap-4 @min-[380px]/card:py-4 @min-[380px]/card:pr-6 @min-[380px]/card:pl-5"
      >
        {/* The tone wash behind the glyph brightens on hover (opacity only). */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[20px] bg-[radial-gradient(60%_110%_at_12%_60%,rgba(var(--tone),0.24),transparent_72%)] opacity-50 transition-opacity duration-300 group-hover/action:opacity-100 lt:opacity-25 lt:group-hover/action:opacity-50"
        />
        <ActionGlyph
          kind={glyph}
          className="relative h-[88px] w-[72px] shrink-0 @min-[380px]/card:h-[118px] @min-[380px]/card:w-[96px]"
        />
        <span className="relative min-w-0 flex-1">
          <span className="block font-display text-[17px] leading-tight font-bold text-white @min-[380px]/card:text-[21px] lt:text-slate-900">
            {title}
          </span>
          <span className="mt-1 block text-[13.5px] leading-snug text-[#a9b8e0] @min-[380px]/card:mt-1.5 @min-[380px]/card:text-[15.5px] lt:text-slate-500">
            {hint}
          </span>
        </span>
        {busy ? (
          <SpinnerIcon className="relative size-5 shrink-0 text-[rgb(var(--tone-hi))] @min-[380px]/card:size-6 lt:text-[var(--tone-lt)]" />
        ) : (
          <ChevronRightIcon
            aria-hidden
            className="relative size-5 shrink-0 text-[rgb(var(--tone-hi))] transition-[translate] duration-300 ease-smooth group-hover/action:translate-x-1 @min-[380px]/card:size-6 lt:text-[var(--tone-lt)]"
            strokeWidth={2.2}
          />
        )}
      </button>
    </NeonPanel>
  );
}
