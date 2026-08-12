import { ChevronLeft } from "lucide-react";
import brandMark from "../../../assets/brand/limmud/logo-book-focus.png";

export function MobileHeader({ onHome, compact = false }: { onHome?: () => void; compact?: boolean }) {
  return <header className={`m-header${compact ? " m-header--compact" : ""}`}>
    {onHome ? <button className="m-icon-button" type="button" aria-label="Back to home" onClick={onHome}><ChevronLeft /></button> : null}
    <img src={brandMark} alt="" className="m-brand" />
    <div><h1>Limmud</h1><span>Local-first learning</span></div>
  </header>;
}
