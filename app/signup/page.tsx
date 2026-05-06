import { Suspense } from "react";
import { SignUpForm } from "./SignUpForm";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
    </main>
  );
}
