import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "path";

// Register Manrope for body text (TTF file in public/fonts)
Font.register({
  family: "Manrope",
  src: path.join(process.cwd(), "public/fonts/Manrope-Regular.ttf"),
});

export interface CertificateProps {
  studentName: string;
  eventTitle: string;
  ceuIndexNumber: string | null;
  ceuValue: string | null;
  aapcCeuTypes: string[] | null;
  completionDate: Date;
  verificationCode: string;
}

const purple = "#815481";
const green = "#89bd40";
const ink = "#0f172a";
const muted = "#64748b";

const s = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 0,
    fontFamily: "Manrope",
  },
  header: {
    backgroundColor: purple,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  headerText: {
    color: "#ffffff",
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 60,
    paddingVertical: 30,
  },
  certTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: purple,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: muted,
    marginBottom: 30,
    textAlign: "center",
  },
  awardedTo: {
    fontSize: 11,
    color: muted,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    marginBottom: 6,
  },
  studentName: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    color: ink,
    marginBottom: 20,
    textAlign: "center",
  },
  divider: {
    width: 80,
    height: 3,
    backgroundColor: green,
    marginBottom: 20,
  },
  eventTitle: {
    fontSize: 14,
    color: ink,
    textAlign: "center",
    marginBottom: 8,
    maxWidth: 500,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 30,
    marginTop: 16,
    marginBottom: 8,
  },
  detailItem: {
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 8,
    color: muted,
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 11,
    color: ink,
  },
  footer: {
    backgroundColor: "#f8f9fc",
    paddingHorizontal: 40,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e3e7ef",
  },
  footerText: {
    fontSize: 7,
    color: muted,
  },
  greenBar: {
    height: 4,
    backgroundColor: green,
  },
});

function CertificateDocument(props: CertificateProps) {
  const {
    studentName,
    eventTitle,
    ceuIndexNumber,
    ceuValue,
    aapcCeuTypes,
    completionDate,
    verificationCode,
  } = props;

  const dateStr = completionDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const credentialStr = aapcCeuTypes?.length
    ? aapcCeuTypes.join(", ")
    : null;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerText}>CCO — CODING CERTIFICATION ORGANIZATION</Text>
        </View>

        <View style={s.body}>
          <Text style={s.certTitle}>Certificate of Completion</Text>
          <Text style={s.subtitle}>Continuing Education Unit (CEU)</Text>

          <Text style={s.awardedTo}>Awarded To</Text>
          <Text style={s.studentName}>{studentName}</Text>

          <View style={s.divider} />

          <Text style={s.eventTitle}>{eventTitle}</Text>

          <View style={s.detailRow}>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>Date Completed</Text>
              <Text style={s.detailValue}>{dateStr}</Text>
            </View>
            {ceuValue && (
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>CEU Credits</Text>
                <Text style={s.detailValue}>{ceuValue}</Text>
              </View>
            )}
            {ceuIndexNumber && (
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>CEU Index</Text>
                <Text style={s.detailValue}>{ceuIndexNumber}</Text>
              </View>
            )}
            {credentialStr && (
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>AAPC CEU Type</Text>
                <Text style={s.detailValue}>{credentialStr}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>
            Verification: {verificationCode}
          </Text>
          <Text style={s.footerText}>
            CCO — Medical Coding Education &amp; Certification
          </Text>
          <Text style={s.footerText}>
            cco.us
          </Text>
        </View>
        <View style={s.greenBar} />
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(
  props: CertificateProps
): Promise<Buffer> {
  return renderToBuffer(<CertificateDocument {...props} />) as Promise<Buffer>;
}
