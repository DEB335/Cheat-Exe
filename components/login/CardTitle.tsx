import { TITLE_RED, TITLE_VIEWBOX, TITLE_WHITE } from "./card-title-paths";

import styles from "./card-title.module.css";

export interface CardTitleProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The login card's heading, "WELCOME TO CHEAT EXE", as the design's own
 * brush lettering (traced paths, see card-title-paths). The SVG is
 * decorative; screen readers get the plain-text name from a hidden span.
 *
 * The box is 444 x 43.3 card units and holds nothing but the ink, so the
 * caller spaces it with ordinary margins. The ink is drawn 9.25 units left
 * of the box, which is where the design puts it relative to the card's
 * content column.
 */
export function CardTitle({ className, style }: CardTitleProps) {
  return (
    <h1 className={className ? `${styles.title} ${className}` : styles.title} style={style}>
      <span className={styles.srOnly}>Welcome to CHEAT EXE</span>
      <svg aria-hidden focusable="false" className={styles.ink} viewBox={TITLE_VIEWBOX}>
        <path fill="#f4f4f5" fillRule="evenodd" d={TITLE_WHITE} />
        <path fill="#e0111a" fillRule="evenodd" d={TITLE_RED} />
      </svg>
    </h1>
  );
}
