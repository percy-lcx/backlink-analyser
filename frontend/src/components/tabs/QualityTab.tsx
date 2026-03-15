import { useState, useEffect } from "react";
import { fetchQualityMatrix, type QualityPoint } from "../../lib/api";
import ScatterPlot from "../charts/ScatterPlot";
import LoadingSpinner from "../LoadingSpinner";
import EmptyState from "../EmptyState";

interface QualityTabProps {
  profile: string;
}

export default function QualityTab({ profile }: QualityTabProps) {
  const [quality, setQuality] = useState<QualityPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchQualityMatrix(profile)
      .then((r) => setQuality(r.items))
      .catch(() => setQuality([]))
      .finally(() => setLoading(false));
  }, [profile]);

  if (loading) return <LoadingSpinner message="Loading quality matrix..." />;
  if (quality.length === 0) return <EmptyState title="No quality data available" />;

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <ScatterPlot data={quality} />
    </div>
  );
}
