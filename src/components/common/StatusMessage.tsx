interface StatusMessageProps {
  children: string;
}

export function StatusMessage({ children }: StatusMessageProps) {
  return <div className="status-message">{children}</div>;
}
