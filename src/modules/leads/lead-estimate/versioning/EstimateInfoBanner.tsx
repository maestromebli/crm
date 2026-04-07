"use client";

type Props = {
  newVersion: number;
  currentVersion: number;
};

export function EstimateInfoBanner({ newVersion, currentVersion }: Props) {
  return (
    <div className="border-b border-blue-100/80 bg-[#e8f1fb]">
      <div className="mx-auto max-w-[1800px] px-4 py-3 text-[13px] leading-relaxed text-blue-950 md:px-6">
        <p>
          {`Буде створена нова версія смети v${newVersion}, а поточна v${currentVersion} буде архівована. Дані не перезаписуються.`}
        </p>
      </div>
    </div>
  );
}
