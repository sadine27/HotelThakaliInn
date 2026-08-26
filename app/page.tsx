import DialNav from "@/components/DialNav";
import LogoMark from "@/components/LogoMark";

const BOOKING_URL = "https://www.booking.com/hotel/np/thakali-inn.html";

const FACTS = [
  { title: "Beside the airport", note: "Sinamangal, Kathmandu 44600" },
  { title: "Thakali breakfast", note: "Served every morning" },
  { title: "Airport shuttle", note: "Paid, on request" },
];

export default function Home() {
  return (
    <>
      <main className="page">
        <header className="masthead">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              className="nu-chip"
              style={{
                width: 52,
                height: 52,
                display: "grid",
                placeItems: "center",
              }}
            >
              <LogoMark size={28} title="Hotel Thakali Inn" />
            </span>
            <span
              style={{
                font: "600 13px/1 var(--font-mono), monospace",
                letterSpacing: "0.18em",
                color: "var(--olive)",
              }}
            >
              HOTEL THAKALI INN
            </span>
          </div>
          <span
            className="locality"
            style={{
              font: "400 11px/1 var(--font-mono), monospace",
              letterSpacing: "0.16em",
              color: "var(--olive-soft)",
            }}
          >
            KATHMANDU · NEPAL
          </span>
        </header>

        <section
          className="nu-well"
          style={{
            marginTop: 40,
            height: "clamp(300px, 46vh, 460px)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <span
            style={{
              font: "400 11px/1 var(--font-mono), monospace",
              letterSpacing: "0.16em",
              color: "var(--olive-soft)",
            }}
          >
            PROPERTY PHOTOGRAPHY
          </span>
        </section>

        <div className="intro">
          <div>
            <p
              style={{
                margin: 0,
                font: "600 11px/1 var(--font-mono), monospace",
                letterSpacing: "0.2em",
                color: "var(--olive)",
              }}
            >
              SINAMANGAL · KALIMATIDOL
            </p>
            <h1
              style={{
                margin: "18px 0 0",
                font: "800 clamp(32px, 5.6vw, 56px)/1.05 var(--font-sans)",
                letterSpacing: "-0.02em",
                color: "var(--green)",
              }}
            >
              The last night before,
              <br />
              the first night after.
            </h1>
          </div>

          <div>
            <p
              style={{
                margin: 0,
                font: "400 16px/1.65 var(--font-sans)",
                color: "var(--muted)",
              }}
            >
              Hotel Thakali Inn keeps clean rooms, family suites, and a hot
              Thakali breakfast in Sinamangal — a short drive from Tribhuvan
              International Airport.
            </p>
            <a
              className="nu-btn"
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 28 }}
            >
              Check availability on Booking.com
            </a>
          </div>
        </div>

        <ul className="facts">
          {FACTS.map((fact) => (
            <li key={fact.title} className="nu-card" style={{ padding: "30px 28px" }}>
              <p
                style={{
                  margin: 0,
                  font: "700 19px/1.2 var(--font-sans)",
                  color: "var(--green)",
                }}
              >
                {fact.title}
              </p>
              <p
                style={{
                  margin: "10px 0 0",
                  font: "400 13px/1.5 var(--font-mono), monospace",
                  color: "var(--olive)",
                }}
              >
                {fact.note}
              </p>
            </li>
          ))}
        </ul>
      </main>

      <DialNav />
    </>
  );
}
