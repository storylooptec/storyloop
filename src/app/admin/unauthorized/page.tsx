import { redirect } from "next/navigation";

export default function AdminUnauthorizedPage() {
  redirect("/admin/login");
}
