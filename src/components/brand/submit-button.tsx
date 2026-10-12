"use client";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";
export function SubmitButton({children,pendingLabel="Saving…",disabled,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{pendingLabel?:string}){
 const {pending}=useFormStatus();return <button {...props} type="submit" disabled={disabled||pending} aria-disabled={disabled||pending}>{pending?pendingLabel:children}</button>;
}
