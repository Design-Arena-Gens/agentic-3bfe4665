import { WorkflowUploader } from "@/components/workflow-uploader";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-48 top-16 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-[460px] w-[460px] rounded-full bg-cyan-500/20 blur-[140px]" />
      </div>
      <main className="relative z-10 flex min-h-screen flex-col pt-20 sm:pt-24">
        <WorkflowUploader />
      </main>
    </div>
  );
}
