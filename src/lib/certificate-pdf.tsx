import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// Register Manrope for body text
Font.register({
  family: "Manrope",
  src: path.join(process.cwd(), "public/fonts/Manrope-Regular.ttf"),
});

// Load logo bytes at module init so it works in serverless contexts
const LOGO_BYTES = (() => {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public/brand/cco-logo.png"));
  } catch {
    return null;
  }
})();

export interface CertificateProps {
  studentName: string;
  eventTitle: string;
  ceuIndexNumber: string | null;
  ceuValue: string | null;
  aapcCeuTypes: string[] | null;
  completionDate: Date;
  verificationCode: string;
  scorePercent?: number | null;
}

// CCO brand palette (from cco.us)
const purple = "#815481";
const purpleDark = "#5f3c60";
const green = "#89bd40";
const gold = "#fcb900";
const ink = "#0f172a";
const muted = "#64748b";
const softBg = "#f4f7fc";

const s = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    fontFamily: "Manrope",
  },

  // ---- Outer decorative frame ----
  frame: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
    borderWidth: 2,
    borderColor: purple,
  },
  frameInner: {
    position: "absolute",
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderWidth: 0.5,
    borderColor: green,
  },

  // ---- Header band ----
  headerBand: {
    position: "absolute",
    top: 36,
    left: 36,
    right: 36,
    height: 80,
    backgroundColor: purple,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  logoBox: {
    width: 60,
    height: 50,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    borderRadius: 2,
  },
  logo: {
    width: 52,
    height: 42,
  },
  headerTextBlock: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2.5,
  },
  headerSubtitle: {
    color: "#ffffff",
    fontSize: 8,
    letterSpacing: 4,
    marginTop: 3,
    opacity: 0.85,
  },
  headerAccent: {
    width: 60,
    height: 50,
  },

  // ---- Body ----
  body: {
    position: "absolute",
    top: 140,
    left: 60,
    right: 60,
    bottom: 120,
    alignItems: "center",
  },

  certType: {
    fontSize: 11,
    letterSpacing: 4,
    color: green,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    textTransform: "uppercase" as const,
  },
  certTitle: {
    fontSize: 34,
    fontFamily: "Helvetica-Bold",
    color: purpleDark,
    marginBottom: 18,
    textAlign: "center",
  },

  presentedPhrase: {
    fontSize: 11,
    color: muted,
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: 0.5,
  },

  studentName: {
    fontSize: 38,
    fontFamily: "Helvetica-Bold",
    color: ink,
    marginBottom: 6,
    textAlign: "center",
  },
  nameUnderline: {
    width: 320,
    height: 2,
    backgroundColor: gold,
    marginBottom: 16,
  },

  achievement: {
    fontSize: 11,
    color: ink,
    textAlign: "center",
    lineHeight: 1.5,
    marginBottom: 8,
    maxWidth: 580,
  },
  eventTitleBold: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: purple,
    textAlign: "center",
    marginBottom: 4,
    marginTop: 4,
    maxWidth: 580,
  },

  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    gap: 14,
  },
  scoreLabel: {
    fontSize: 9,
    color: muted,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
  },
  scoreValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: green,
  },

  // ---- Seal (right side gold badge) ----
  seal: {
    position: "absolute",
    top: 265,
    right: 60,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#e09b00",
  },
  sealRing: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1,
    borderColor: gold,
    top: 261,
    right: 56,
  },
  sealTop: {
    fontSize: 10,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 3,
    marginBottom: 3,
  },
  sealMain: {
    fontSize: 18,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  sealBottom: {
    fontSize: 6.5,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    marginTop: 4,
  },

  // ---- Signature + date row ----
  footerRow: {
    position: "absolute",
    bottom: 80,
    left: 100,
    right: 100,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sigBlock: {
    alignItems: "center",
    minWidth: 200,
  },
  sigLine: {
    width: 200,
    height: 1,
    backgroundColor: ink,
    marginBottom: 4,
  },
  sigName: {
    fontSize: 11,
    color: ink,
    fontFamily: "Helvetica-Bold",
  },
  sigTitle: {
    fontSize: 8,
    color: muted,
    marginTop: 1,
    letterSpacing: 0.8,
  },
  sigCaption: {
    fontSize: 18,
    color: purpleDark,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },

  // ---- Verification footer ----
  verifBar: {
    position: "absolute",
    bottom: 40,
    left: 60,
    right: 60,
    borderTopWidth: 0.5,
    borderTopColor: "#e3e7ef",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  verifText: {
    fontSize: 7,
    color: muted,
    letterSpacing: 0.5,
  },
  verifCode: {
    fontSize: 7,
    color: purple,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },

  // ---- Corner ornaments ----
  cornerTL: {
    position: "absolute",
    top: 30,
    left: 30,
    width: 12,
    height: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: green,
  },
  cornerTR: {
    position: "absolute",
    top: 30,
    right: 30,
    width: 12,
    height: 12,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: green,
  },
  cornerBL: {
    position: "absolute",
    bottom: 30,
    left: 30,
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: green,
  },
  cornerBR: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: green,
  },
});

function CertificateDocument(props: CertificateProps) {
  const {
    studentName,
    eventTitle,
    completionDate,
    verificationCode,
    ceuValue,
    scorePercent,
  } = props;

  const dateStr = completionDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Name auto-shrink helper (approximate char-width heuristic)
  const nameFontSize =
    studentName.length > 30 ? 28 : studentName.length > 22 ? 32 : 38;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Decorative frames */}
        <View style={s.frame} />
        <View style={s.frameInner} />
        <View style={s.cornerTL} />
        <View style={s.cornerTR} />
        <View style={s.cornerBL} />
        <View style={s.cornerBR} />

        {/* Header band */}
        <View style={s.headerBand}>
          <View style={s.logoBox}>
            {LOGO_BYTES ? <Image src={LOGO_BYTES} style={s.logo} /> : null}
          </View>
          <View style={s.headerTextBlock}>
            <Text style={s.headerTitle}>CCO ACADEMY</Text>
            <Text style={s.headerSubtitle}>LEARN IT · GET CERTIFIED · STAY CERTIFIED</Text>
          </View>
          <View style={s.headerAccent} />
        </View>

        {/* Seal ring + badge (right side) */}
        <View style={s.sealRing} />
        <View style={s.seal}>
          <Text style={s.sealTop}>CCO</Text>
          <Text style={s.sealMain}>CERTIFIED</Text>
          <Text style={s.sealBottom}>ACHIEVEMENT</Text>
        </View>

        {/* Body */}
        <View style={s.body}>
          <Text style={s.certType}>Certificate of Achievement</Text>
          <Text style={s.certTitle}>CCO Academy</Text>

          <Text style={s.presentedPhrase}>This certificate is proudly presented to</Text>

          <Text style={{ ...s.studentName, fontSize: nameFontSize }}>
            {studentName}
          </Text>
          <View style={s.nameUnderline} />

          <Text style={s.achievement}>
            for successfully completing the CCO learning experience
          </Text>
          <Text style={s.eventTitleBold}>{eventTitle}</Text>
          <Text style={s.achievement}>
            demonstrating mastery of the covered medical coding material.
          </Text>

          {(scorePercent != null || ceuValue) && (
            <View style={s.scoreRow}>
              {scorePercent != null && (
                <>
                  <Text style={s.scoreLabel}>Final Score</Text>
                  <Text style={s.scoreValue}>{scorePercent}%</Text>
                </>
              )}
              {ceuValue && (
                <>
                  <Text style={s.scoreLabel}>· CEU</Text>
                  <Text style={s.scoreValue}>{ceuValue}</Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* Signature + date row */}
        <View style={s.footerRow}>
          <View style={s.sigBlock}>
            <Text style={s.sigCaption}>Laureen Jandroep</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>Laureen Jandroep, CPC, COC, CPC-I</Text>
            <Text style={s.sigTitle}>FOUNDER &amp; LEAD INSTRUCTOR, CCO</Text>
          </View>
          <View style={s.sigBlock}>
            <Text style={s.sigCaption}>{dateStr}</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>Date of Issue</Text>
            <Text style={s.sigTitle}>CERTIFIED COMPLETION</Text>
          </View>
        </View>

        {/* Verification footer */}
        <View style={s.verifBar}>
          <Text style={s.verifText}>Verify at cco.us/verify</Text>
          <Text style={s.verifCode}>{verificationCode}</Text>
          <Text style={s.verifText}>CCO Academy · cco.us</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(
  props: CertificateProps
): Promise<Buffer> {
  return renderToBuffer(<CertificateDocument {...props} />) as Promise<Buffer>;
}
