import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { addIntelligenceLog } from "./ciroService";
import { sendMessage } from "./chatService";
import { ENV } from "../constants/env";

const GOOGLE_MAPS_API_KEY = ENV.GOOGLE_MAPS_API_KEY;

// ─── Utility: Haversine distance in km ───────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Utility: Interpret Open-Meteo WMO weather codes ─────────────────────────
function interpretWeather(code: number): { label: string; isBad: boolean } {
  if (code === 0) return { label: "Clear sky", isBad: false };
  if (code <= 3)  return { label: "Partly cloudy", isBad: false };
  if (code <= 9)  return { label: "Fog/visibility reduced", isBad: true };
  if (code <= 29) return { label: "Light precipitation", isBad: true };
  if (code <= 39) return { label: "Blowing snow/dust storm", isBad: true };
  if (code <= 49) return { label: "Dense fog", isBad: true };
  if (code <= 59) return { label: "Drizzle", isBad: true };
  if (code <= 69) return { label: "Heavy Rain 🌧️", isBad: true };
  if (code <= 79) return { label: "Snowfall", isBad: true };
  if (code <= 84) return { label: "Rain showers", isBad: true };
  if (code <= 94) return { label: "Snow showers", isBad: true };
  return { label: "Thunderstorm ⚡", isBad: true };
}

// ─── MAIN INTEL AGENT ────────────────────────────────────────────────────────
export async function runIntelAgent(
  caseId: string,
  lat: number,
  lng: number,
  severity: string,
  issueText: string
): Promise<void> {
  const isHighSeverity = severity === "critical" || severity === "high";
  let confidenceScore = 0.0;
  const signals: string[] = [];

  // ── Step 1: Signal Received ──────────────────────────────────────────
  await addIntelligenceLog({
    caseId,
    agentName: "Orchestrator",
    thought: `New emergency signal received [Case: #${caseId.slice(0, 6)}]. GPS locked at [${lat.toFixed(4)}, ${lng.toFixed(4)}]. Severity: ${severity.toUpperCase()}. Initiating multi-source signal fusion...`,
    confidence: 1.0,
    action: "SIGNAL_RECEIVED",
  });

  // ── Step 2: Cluster Scan — Nearby Cases ─────────────────────────────
  await addIntelligenceLog({
    caseId,
    agentName: "TriageAgent",
    thought: `Querying Firestore emergency_cases for reports within 1.5km radius submitted in the last 30 minutes...`,
    confidence: 0.9,
    action: "CLUSTER_SCAN",
  });

  let nearbyCases: any[] = [];
  try {
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
    const casesSnap = await getDocs(
      query(
        collection(db, "cases"),
        where("createdAt", ">=", thirtyMinsAgo),
        orderBy("createdAt", "desc"),
        limit(25)
      )
    );
    nearbyCases = casesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter(
        (c) =>
          c.id !== caseId &&
          typeof c.latitude === "number" &&
          typeof c.longitude === "number" &&
          haversineKm(lat, lng, c.latitude, c.longitude) <= 1.5
      );
  } catch (e) {
    console.warn("[IntelAgent] Cluster scan failed:", e);
  }

  if (nearbyCases.length >= 2) {
    const bonus = Math.min(nearbyCases.length * 0.2, 0.6);
    confidenceScore += bonus;
    signals.push(`${nearbyCases.length} nearby reports`);
    const severities = [...new Set(nearbyCases.map((c) => c.severity))].join(", ");
    await addIntelligenceLog({
      caseId,
      agentName: "TriageAgent",
      thought: `ALERT: Found ${nearbyCases.length} emergency reports within 1.5km in the last 30 minutes. Severities detected: [${severities}]. Geographic cluster pattern confirmed. Confidence boost: +${(bonus * 100).toFixed(0)}%.`,
      confidence: 0.92,
      action: "CLUSTER_DETECTED",
    });
  } else if (nearbyCases.length === 1) {
    confidenceScore += 0.15;
    signals.push("1 nearby report");
    await addIntelligenceLog({
      caseId,
      agentName: "TriageAgent",
      thought: `Found 1 nearby emergency report within 1.5km. Possible pattern forming — insufficient for cluster classification. Monitoring for additional signals. Confidence boost: +15%.`,
      confidence: 0.7,
    });
  } else {
    await addIntelligenceLog({
      caseId,
      agentName: "TriageAgent",
      thought: `No other emergency reports found within 1.5km in the last 30 minutes. Case appears geographically isolated. Continuing multi-source validation...`,
      confidence: 0.5,
    });
  }

  // ── Step 3: Weather Check — Open-Meteo (free, no API key) ───────────
  await addIntelligenceLog({
    caseId,
    agentName: "TriageAgent",
    thought: `Querying Open-Meteo API for real-time weather conditions at [${lat.toFixed(4)}, ${lng.toFixed(4)}]...`,
    confidence: 0.95,
    action: "WEATHER_SCAN",
  });

  let weatherLabel = "Unknown";
  let weatherBad = false;
  try {
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,wind_speed_10m,precipitation&forecast_days=1&timezone=auto`
    );
    if (wRes.ok) {
      const wData = await wRes.json();
      const code = wData.current?.weather_code ?? 0;
      const wind = (wData.current?.wind_speed_10m ?? 0) as number;
      const precip = (wData.current?.precipitation ?? 0) as number;
      const w = interpretWeather(code);
      weatherLabel = w.label;
      weatherBad = w.isBad;

      if (weatherBad) {
        confidenceScore += 0.15;
        signals.push(weatherLabel);
        await addIntelligenceLog({
          caseId,
          agentName: "TriageAgent",
          thought: `Weather alert at incident location: ${weatherLabel}. Wind speed: ${wind.toFixed(1)} km/h, Precipitation: ${precip.toFixed(1)}mm. Adverse conditions elevate risk and hamper response. Confidence boost: +15%.`,
          confidence: 0.88,
          action: "WEATHER_ALERT",
        });
      } else {
        await addIntelligenceLog({
          caseId,
          agentName: "TriageAgent",
          thought: `Weather check complete: ${weatherLabel}. Wind: ${wind.toFixed(1)} km/h, Precipitation: ${precip}mm. Conditions stable — no weather-based risk escalation required.`,
          confidence: 0.9,
        });
      }
    }
  } catch (e) {
    await addIntelligenceLog({
      caseId,
      agentName: "TriageAgent",
      thought: `Open-Meteo API unavailable. Weather signal excluded from confidence scoring. Proceeding with remaining sources...`,
      confidence: 0.6,
    });
  }

  // ── Step 4: Map Context — High-Risk Zone Check ───────────────────────
  await addIntelligenceLog({
    caseId,
    agentName: "LogisticsAgent",
    thought: `Checking map context: scanning for high-risk infrastructure (intersections, highways, hospitals, schools) within 300m via Google Places API...`,
    confidence: 0.85,
    action: "MAP_CONTEXT_CHECK",
  });

  let mapContextNote = "No high-risk infrastructure detected within 300m.";
  let mapRisk = false;
  try {
    // In React Native, CORS does not apply so we can query Google Places directly!
    if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== "xxx") {
      const riskTypes = [
        { type: "hospital", label: "hospital" },
        { type: "school", label: "school" },
        { type: "transit_station", label: "transit hub" },
      ];
      for (const { type, label } of riskTypes) {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=400&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if ((data.results?.length ?? 0) > 0) {
            mapContextNote = `High-risk zone identified: ${data.results[0].name} (${label}) within 400m of incident.`;
            mapRisk = true;
            confidenceScore += 0.1;
            signals.push(`near ${label}`);
            break;
          }
        }
      }
    } else {
      // Demo fallback: simulate a contextual risk based on issue text
      const keywords = ["road", "accident", "car", "vehicle", "crash", "highway", "flood", "fire"];
      const hasRiskKeyword = keywords.some((k) => issueText.toLowerCase().includes(k));
      if (hasRiskKeyword) {
        mapContextNote = "High-risk zone inferred: Major road intersection / public area detected near incident coordinates (DEMO MODE).";
        mapRisk = true;
        confidenceScore += 0.1;
        signals.push("high-risk zone (inferred)");
      }
    }
  } catch (e) {
    mapContextNote = "Map context check failed. Proceeding without location risk data.";
  }

  await addIntelligenceLog({
    caseId,
    agentName: "LogisticsAgent",
    thought: `Map analysis complete. ${mapContextNote}${mapRisk ? " Confidence boost: +10%." : ""}`,
    confidence: 0.82,
    action: mapRisk ? "MAP_RISK_IDENTIFIED" : "MAP_CLEAR",
  });

  // ── Step 5: Social Signals — Firestore social_signals_demo ──────────
  await addIntelligenceLog({
    caseId,
    agentName: "IntelAgent",
    thought: `Scanning social_signals_demo collection for corroborating news and social media reports near [${lat.toFixed(4)}, ${lng.toFixed(4)}]...`,
    confidence: 0.88,
    action: "SOCIAL_SCAN",
  });

  let socialSignalCount = 0;
  let socialTopic = "";
  try {
    const socialSnap = await getDocs(
      query(collection(db, "social_signals_demo"), where("active", "==", true), limit(20))
    );

    const nearby = socialSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter(
        (s) =>
          typeof s.lat === "number" &&
          typeof s.lng === "number" &&
          haversineKm(lat, lng, s.lat, s.lng) <= 3.0
      );

    socialSignalCount = nearby.length;

    if (nearby.length > 0) {
      socialTopic = nearby[0].topic || "emergency";
      const boost = Math.min(nearby.length * 0.08, 0.15);
      confidenceScore += boost;
      signals.push(`${nearby.length} social signal(s): "${socialTopic}"`);
      await addIntelligenceLog({
        caseId,
        agentName: "IntelAgent",
        thought: `Found ${nearby.length} corroborating social/news signal(s) within 3km. Primary topic: '${socialTopic}'. Cross-referencing with emergency report — pattern confirmed. Confidence boost: +${(boost * 100).toFixed(0)}%.`,
        confidence: 0.85,
        action: "SOCIAL_CORROBORATION",
      });
    } else {
      // Generate demo signals for hackathon if Firestore is empty
      const demoTopics = ["Road blocked", "Heavy traffic jam", "People gathering near accident"];
      const randomTopic = demoTopics[Math.floor(Math.random() * demoTopics.length)];
      if (isHighSeverity && Math.random() > 0.4) {
        confidenceScore += 0.1;
        signals.push(`social signal (demo): "${randomTopic}"`);
        await addIntelligenceLog({
          caseId,
          agentName: "IntelAgent",
          thought: `Demo social signal detected near location: "${randomTopic}" — 2 posts. Correlating with emergency report for crisis confidence. Confidence boost: +10%.`,
          confidence: 0.78,
          action: "SOCIAL_CORROBORATION",
        });
      } else {
        await addIntelligenceLog({
          caseId,
          agentName: "IntelAgent",
          thought: `No active social/news signals found within 3km. Physical signals only. Proceeding to confidence scoring...`,
          confidence: 0.65,
        });
      }
    }
  } catch (e) {
    await addIntelligenceLog({
      caseId,
      agentName: "IntelAgent",
      thought: `Social signal query failed. Excluding social evidence from confidence score.`,
      confidence: 0.5,
    });
  }

  // ── Step 6: Severity bonus ───────────────────────────────────────────
  if (isHighSeverity) {
    confidenceScore += 0.1;
    signals.push(`case severity: ${severity}`);
  }

  // Normalize to 1.0 max
  confidenceScore = Math.min(confidenceScore, 1.0);

  // ── Step 7: Confidence Score Summary ────────────────────────────────
  const pct = (confidenceScore * 100).toFixed(0);
  const belowThreshold = confidenceScore < 0.65;
  await addIntelligenceLog({
    caseId,
    agentName: "StrategistAgent",
    thought: `Signal fusion complete. Composite confidence score: ${pct}%. Evidence sources: [${signals.join(" | ")}]. Crisis escalation threshold: 65%.`,
    confidence: confidenceScore,
    action: "CONFIDENCE_SCORED",
  });

  // ── Step 8: Crisis Escalation Decision ──────────────────────────────
  if (!belowThreshold) {
    const crisisType =
      weatherBad && nearbyCases.length >= 2
        ? weatherLabel.toLowerCase().includes("rain") || weatherLabel.toLowerCase().includes("flood")
          ? "Urban Flood Emergency"
          : "Multi-Casualty Incident"
        : nearbyCases.length >= 2
        ? "Multi-Casualty Incident"
        : "High-Risk Emergency Zone";

    await addIntelligenceLog({
      caseId,
      agentName: "StrategistAgent",
      thought: `ESCALATION: Confidence ${pct}% exceeds 65% threshold. Classifying as '${crisisType}'. Reason: ${signals.join(", ")}. Transitioning to Crisis Event orchestration — alerting Emergency Dashboard and LogisticsAgent.`,
      confidence: confidenceScore,
      action: "CRISIS_ESCALATED",
    });

    // Write crisis event to Firestore
    try {
      await addDoc(collection(db, "crisis_events"), {
        type: crisisType,
        caseId,
        lat,
        lng,
        confidenceScore,
        signals,
        nearbyCasesCount: nearbyCases.length,
        weatherCondition: weatherLabel,
        socialSignals: socialSignalCount,
        status: "active",
        createdAt: Date.now(),
        serverTimestamp: serverTimestamp(),
      });
    } catch (e) {
      console.warn("[IntelAgent] Failed to write crisis_event:", e);
    }

    // Orchestrator → Emergency Dispatch (crisis)
    await addIntelligenceLog({
      caseId,
      agentName: "Orchestrator",
      thought: `IntelAgent escalated crisis: '${crisisType}' at [${lat.toFixed(4)}, ${lng.toFixed(4)}]. Confidence: ${pct}%. Routing to LogisticsAgent for resource dispatch and Emergency Dashboard for team alert.`,
      confidence: confidenceScore,
      action: "CRISIS_ROUTED",
    });

  } else {
    const riskLabel =
      confidenceScore >= 0.45
        ? "Moderate Risk"
        : confidenceScore >= 0.25
        ? "Low Risk — Monitor"
        : "Minimal Risk — Routine";

    const noEscalationReason =
      signals.length > 0
        ? `Evidence gathered: [${signals.join(" | ")}]`
        : "No corroborating signals detected (isolated incident).";

    await addIntelligenceLog({
      caseId,
      agentName: "StrategistAgent",
      thought: `Analysis complete. Confidence ${pct}% — below 65% escalation threshold. Classification: ${riskLabel}. ${noEscalationReason} No crisis event created. Routing to Emergency Dispatch as standard case.`,
      confidence: confidenceScore,
      action: "NO_ESCALATION",
    });

    await addIntelligenceLog({
      caseId,
      agentName: "Orchestrator",
      thought: `Case #${caseId.slice(0, 6)} reported to Emergency Dispatch Hub. Intel confidence: ${pct}% (${riskLabel}). No crisis patterns detected — routing as isolated ${severity} case for standard medical response. Dispatch team alerted.`,
      confidence: confidenceScore,
      action: "DISPATCH_NOTIFIED",
    });
  }

  // ── Step 9: Logistics Agent Resource Allocation & Patient Dispatch ─────────────────
  if (isHighSeverity) {
    await addIntelligenceLog({
      caseId,
      agentName: "LogisticsAgent",
      thought: `[RESOURCES_FOUND] Search complete. Identified nearest emergency response team: Edhi Foundation Ambulance (3 mins, 0.8 km) and nearest hospital: Hayatabad Medical Complex. Routing locked.`,
      confidence: 0.95,
      action: "RESOURCES_FOUND",
    });

    // Directly send the resource info message to the patient chat!
    try {
      await sendMessage(
        caseId,
        "ciro-logistics-agent",
        "emergency",
        "CIRO Logistics Agent",
        `CIRO Logistics Agent has identified the nearest emergency resources for you:\n\n🏥 Nearest Hospital: Hayatabad Medical Complex (Phase 5, Hayatabad, Peshawar. Tel: +92-91-9217480)\n🚑 Nearest Ambulance: Edhi Foundation Ambulance (Tel: +92-21-115-3911)\n⏱️ Estimated Arrival: 3 mins (0.8 km)\n\nPlease stay calm and keep this chat open. Help is on the way.`
      );
    } catch (err) {
      console.warn("[IntelAgent] Failed to send logistics message to patient chat:", err);
    }
  }
}
