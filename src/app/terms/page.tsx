import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section, List } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — FindTao",
  description: "The terms for using FindTao: what the tool is, the affiliate disclosure, and the limits on our liability.",
};

const CONTACT_EMAIL = "fuzion.viziion@gmail.com";
const OPERATOR = "FindTao";
const GOVERNING_LAW = "the Commonwealth of Kentucky, USA";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="July 9, 2026"
      intro={
        <p>
          These terms govern your use of {OPERATOR} (the &ldquo;Service&rdquo;). By using the
          Service you agree to them. If you don&rsquo;t agree, please don&rsquo;t use it.
        </p>
      }
    >
      <Section heading="1. What FindTao is (and isn't)">
        <p>
          {OPERATOR} is a <strong className="text-mist-100">discovery, organization, and link-
          conversion tool</strong> for products on third-party Chinese marketplaces. We help you find
          listings, plan hauls, estimate sizing and shipping, and convert a product link into the
          equivalent link on the shopping agent of your choice.
        </p>
        <p>
          We are <strong className="text-mist-100">not a marketplace, seller, agent, or payment
          processor.</strong> We do not sell, ship, or handle any product, and we never take payment
          from you. Every purchase happens on a third-party site (a shopping agent and, ultimately,
          the marketplace seller), under that site&rsquo;s own terms. We are not a party to, and are
          not responsible for, your transactions with them.
        </p>
      </Section>

      <Section heading="2. Affiliate / referral disclosure">
        <p>
          Outbound links to shopping agents may include our referral code. If you buy through one, we
          may earn a commission from that agent at no extra cost to you — the price you pay is the
          same whether or not the code is present. You can override or remove referral codes in
          Settings. See our <Link href="/privacy" className="text-neon-300 underline">Privacy Policy</Link>{" "}
          for related data handling.
        </p>
      </Section>

      <Section heading="3. Accounts">
        <List
          items={[
            "An account is optional — the Service is fully usable without one.",
            "If you create one, provide accurate information and keep your login secure. You're responsible for activity under your account.",
            "You must be old enough to form a binding contract where you live (and at least 13).",
            "You may delete your account at any time by contacting us.",
          ]}
        />
      </Section>

      <Section heading="4. Acceptable use">
        <p>You agree not to:</p>
        <List
          items={[
            "Use the Service to break the law or infringe others' rights, including intellectual-property or customs/import laws that apply to you.",
            "Abuse, overload, scrape, or attempt to bypass rate limits or security on the Service or its endpoints.",
            "Resell, rebrand, or commercially exploit the Service without our permission.",
            "Upload or submit content you have no right to submit.",
          ]}
        />
        <p>
          You are solely responsible for deciding whether a given item is legal for you to import and
          for complying with your country&rsquo;s customs, duty, and intellectual-property rules.
        </p>
      </Section>

      <Section heading="5. Third-party listings, data, and links">
        <p>
          Listings, store pages, photos, prices, and seller descriptions shown in {OPERATOR} come
          from third-party marketplaces and photo hosts and are displayed for your convenience. We
          don&rsquo;t control them, don&rsquo;t guarantee they&rsquo;re accurate, current, available,
          or authentic, and we don&rsquo;t endorse any seller, product, or agent. Trademarks and brand
          names belong to their respective owners; their appearance in third-party listings is not an
          endorsement by, or affiliation with, us.
        </p>
      </Section>

      <Section heading="6. Estimates are estimates">
        <p>
          Several features are <strong className="text-mist-100">planning aids, not guarantees</strong>:
        </p>
        <List
          items={[
            "AI size recommendations are a best-effort reading of a seller's chart against measurements you provide. Charts are often approximate or mislabeled — verify before you buy.",
            "Shipping estimates use placeholder rate cards; the real quote comes from your agent at checkout.",
            "Currency conversions are indicative and based on third-party rates.",
            "Converted agent links and parsed marketplace links are generated automatically and formats can change without notice; always confirm the item is correct on the destination site before purchasing.",
          ]}
        />
        <p>
          Decisions you make based on these features are your own responsibility.
        </p>
      </Section>

      <Section heading="7. Intellectual property in the Service">
        <p>
          The {OPERATOR} name, interface, and original content are ours or our licensors&rsquo; and
          are protected by law. We grant you a personal, non-exclusive, revocable license to use the
          Service for its intended purpose. These terms don&rsquo;t transfer any ownership to you.
        </p>
      </Section>

      <Section heading="8. Disclaimer of warranties">
        <p>
          The Service is provided <strong className="text-mist-100">&ldquo;as is&rdquo; and &ldquo;as
          available,&rdquo;</strong> without warranties of any kind, whether express or implied,
          including merchantability, fitness for a particular purpose, and non-infringement. We do not
          warrant that the Service will be uninterrupted, error-free, secure, or that any listing,
          estimate, or converted link will be accurate.
        </p>
      </Section>

      <Section heading="9. Limitation of liability">
        <p>
          To the fullest extent permitted by law, {OPERATOR} and its operators will not be liable for
          any indirect, incidental, special, consequential, or punitive damages, or for any lost
          profits, lost purchases, customs seizures, shipping losses, or disputes with sellers or
          agents, arising from your use of the Service. Our total liability for any claim relating to
          the Service will not exceed USD $100 or the amount you paid us in the past 12 months
          (which is typically $0), whichever is greater.
        </p>
      </Section>

      <Section heading="10. Indemnification">
        <p>
          You agree to indemnify and hold harmless {OPERATOR} and its operators from claims, losses,
          and expenses (including reasonable legal fees) arising out of your use of the Service, your
          violation of these terms, or your violation of any law or third-party right.
        </p>
      </Section>

      <Section heading="11. Changes & termination">
        <p>
          We may modify or discontinue the Service, or update these terms, at any time. Material
          changes take effect when we post them and update the date above; continued use means you
          accept them. We may suspend or terminate access that violates these terms.
        </p>
      </Section>

      <Section heading="12. Governing law & contact">
        <p>
          These terms are governed by the laws of {GOVERNING_LAW}, without regard to conflict-of-law
          rules. Questions: <span className="text-mist-100">{CONTACT_EMAIL}</span>.
        </p>
      </Section>
    </LegalPage>
  );
}
