import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/product-form";

export default function NewProductPage() {
  return <div className="admin-page narrow-page"><Link href="/admin/products" className="back-link"><ArrowLeft size={16} /> Products</Link><header className="page-head"><div><span className="page-kicker">New product</span><h1>Add something good</h1><p>Start with the details customers need to choose confidently.</p></div></header><ProductForm /></div>;
}
