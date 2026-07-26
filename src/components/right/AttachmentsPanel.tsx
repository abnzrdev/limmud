import { ExternalLink, RefreshCw, Search, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import {
  collectCourseMaterials,
  collectLessonMaterials,
  filterMaterials,
  groupMaterials,
  materialGroups,
  type CourseMaterial,
} from "../../lib/courseMaterials";
import type { CourseEntry } from "../../types/course";
import type { LessonResource } from "../../types/resource";

interface Props {
  entries: CourseEntry[];
  selectedEntry: CourseEntry | null;
  resources: LessonResource[];
  onAddMaterial: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onOpenMaterial: (material: CourseMaterial) => void;
  onOpenResource: (resource: LessonResource) => void;
}

export function AttachmentsPanel(props: Props) {
  const [query, setQuery] = useState("");
  const all = useMemo(() => collectCourseMaterials(props.entries), [props.entries]);
  const lesson = filterMaterials(collectLessonMaterials(all, props.selectedEntry), query);
  const grouped = groupMaterials(filterMaterials(all, query));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const imported = props.resources.filter((item) =>
    item.lessonPath === props.selectedEntry?.relativePath && resourceMatches(item, normalizedQuery),
  );
  const importedByGroup = Object.fromEntries(materialGroups.map((group) => [
    group,
    props.resources.filter((item) => resourceGroup(item) === group && resourceMatches(item, normalizedQuery)),
  ])) as Record<(typeof materialGroups)[number], LessonResource[]>;
  const hasCourseMaterials = materialGroups.some((group) => grouped[group].length || importedByGroup[group].length);

  return (
    <section className="panel-section course-materials">
      <div className="panel-title-row">
        <h3 className="panel-title">Course Materials</h3>
        <button className="button-primary" type="button" onClick={props.onAddMaterial}>
          <Upload aria-hidden="true" />Add Material
        </button>
      </div>
      <div className="material-actions">
        <label className="material-search"><Search aria-hidden="true" /><input aria-label="Search course materials" placeholder="Search materials..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <button className="icon-button" type="button" aria-label="Refresh Course Materials" onClick={props.onRefresh} disabled={props.refreshing}><RefreshCw aria-hidden="true" /></button>
      </div>
      <h4>This lesson</h4>
      {!props.selectedEntry ? <p className="material-empty">Select a lesson to see its materials.</p> : null}
      {props.selectedEntry && !lesson.length && !imported.length ? <p className="material-empty">No materials for this lesson.</p> : null}
      <MaterialList materials={lesson} onOpen={props.onOpenMaterial} />
      {imported.map((resource) => (
        <button className="material-row" type="button" key={resource.storedRelativePath} onClick={() => props.onOpenResource(resource)}>
          <span><strong>{resource.originalFilename}</strong><small>{resource.lessonPath}</small></span><ExternalLink aria-hidden="true" />
        </button>
      ))}
      <h4>Whole course</h4>
      {!hasCourseMaterials ? <p className="material-empty">{query ? "No materials match your search." : "No course materials found."}</p> : null}
      {materialGroups.map((group) => grouped[group].length || importedByGroup[group].length ? (
        <div className="material-group" key={group}><h5>{group}</h5><MaterialList materials={grouped[group]} onOpen={props.onOpenMaterial} />
          {importedByGroup[group].map((resource) => <ResourceRow key={resource.storedRelativePath} resource={resource} onOpen={props.onOpenResource} />)}
        </div>
      ) : null)}
    </section>
  );
}

function ResourceRow({ resource, onOpen }: { resource: LessonResource; onOpen: (resource: LessonResource) => void }) {
  return <button className="material-row" type="button" title={resource.originalFilename} onClick={() => onOpen(resource)}><span><strong>{resource.originalFilename}</strong><small>{resource.lessonPath.replace(/[/\\][^/\\]+$/, "") || "."}</small></span><ExternalLink aria-hidden="true" /></button>;
}

function resourceMatches(resource: LessonResource, query: string) {
  return !query || resource.originalFilename.toLocaleLowerCase().includes(query) || resource.lessonPath.toLocaleLowerCase().includes(query);
}

function resourceGroup(resource: LessonResource): (typeof materialGroups)[number] {
  if (resource.category === "image") return "Images";
  if (resource.category === "pdf" || resource.category === "text") return "Documents";
  return "Other";
}

function MaterialList({ materials, onOpen }: { materials: CourseMaterial[]; onOpen: (material: CourseMaterial) => void }) {
  return <>{materials.map((material) => (
    <button className="material-row" type="button" key={material.relativePath} title={material.relativePath} onClick={() => onOpen(material)}>
      <span><strong>{material.name}</strong><small>{material.parentFolder}</small></span><ExternalLink aria-hidden="true" />
    </button>
  ))}</>;
}
