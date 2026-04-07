type StickySidePanelProps = {
  children: React.ReactNode;
};

export function StickySidePanel({ children }: StickySidePanelProps) {
  return <aside className="space-y-3 lg:sticky lg:top-4">{children}</aside>;
}

