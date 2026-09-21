import { redirect } from 'next/navigation';

/**
 * Legacy visual prototype route.
 * The operational Admin is now canonical at /intake and reads ERP5.
 * Keep the old URL as a safe redirect so bookmarks cannot open demo data.
 */
export default function DesignRedirect() {
  redirect('/intake');
}
