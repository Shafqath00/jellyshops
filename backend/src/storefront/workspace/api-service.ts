import type { AssignmentService } from "./assignment-service.js";
import type { GlobalSectionService } from "./global-section-service.js";
import type { MenuService } from "./menu-service.js";
import type { AssignableResourceType } from "./repositories/assignment-repository.js";
import type { MenuItem, UpdateMenuInput } from "./repositories/menu-repository.js";
import type { TemplateType, UpdateTemplateRecordInput } from "./repositories/template-repository.js";
import type { ThemeSettings } from "./repositories/theme-repository.js";
import type { StorefrontWorkspaceApi } from "./routes.js";
import type { TemplateService } from "./template-service.js";
import type { ThemeService } from "./theme-service.js";
import type { StorefrontWorkspaceReader } from "./workspace-reader.js";

export class DefaultStorefrontWorkspaceApi implements StorefrontWorkspaceApi {
  constructor(
    private readonly workspace: StorefrontWorkspaceReader,
    private readonly templates: TemplateService,
    private readonly globals: GlobalSectionService,
    private readonly menus: MenuService,
    private readonly theme: ThemeService,
    private readonly assignments: AssignmentService,
  ) {}

  listThemeCatalog(_storeId: string) {
    return Promise.resolve([]);
  }

  getWorkspace(storeId: string) {
    return this.workspace.getWorkspace(storeId);
  }

  listTemplates(storeId: string, type?: TemplateType) {
    return this.templates.listTemplates(storeId, type);
  }

  getTemplate(storeId: string, templateId: string) {
    return this.templates.getTemplate(storeId, templateId);
  }

  createTemplate(
    storeId: string,
    input: { type: TemplateType; name: string; handle?: string; layout: Record<string, unknown> },
  ) {
    return this.templates.createTemplate(storeId, input);
  }

  updateTemplate(
    storeId: string,
    templateId: string,
    expectedRevision: number,
    patch: UpdateTemplateRecordInput,
  ) {
    return this.templates.updateTemplate(storeId, templateId, expectedRevision, patch);
  }

  cloneTemplate(storeId: string, sourceTemplateId: string, input: { name: string; handle: string }) {
    return this.templates.cloneTemplate(storeId, sourceTemplateId, input);
  }

  listGlobalSections(storeId: string) {
    return this.globals.listGlobalSections(storeId);
  }

  getGlobalSection(storeId: string, id: string) {
    return this.globals.getGlobalSection(storeId, id);
  }

  createGlobalSection(storeId: string, input: { name: string; section: Record<string, unknown> }) {
    return this.globals.createGlobalSection(storeId, input);
  }

  updateGlobalSection(
    storeId: string,
    id: string,
    expectedRevision: number,
    patch: { name?: string; section?: Record<string, unknown> },
  ) {
    return this.globals.updateGlobalSection(storeId, id, expectedRevision, patch);
  }

  listPresets(storeId: string) {
    return this.globals.listPresets(storeId);
  }

  createPreset(storeId: string, input: { name: string; section: Record<string, unknown> }) {
    return this.globals.createPreset(storeId, input);
  }

  instantiatePreset(storeId: string, presetId: string) {
    return this.globals.instantiatePreset(storeId, presetId);
  }

  listMenus(storeId: string) {
    return this.menus.listMenus(storeId);
  }

  getMenu(storeId: string, id: string) {
    return this.menus.getMenu(storeId, id);
  }

  createMenu(storeId: string, input: { name: string; handle: string; items: MenuItem[] }) {
    return this.menus.createMenu(storeId, input);
  }

  updateMenu(
    storeId: string,
    id: string,
    expectedRevision: number,
    patch: UpdateMenuInput,
  ) {
    return this.menus.updateMenu(storeId, id, expectedRevision, patch);
  }

  getThemeConfiguration(storeId: string) {
    return this.theme.getThemeConfiguration(storeId);
  }

  saveThemeConfiguration(
    storeId: string,
    expectedRevision: number | null,
    input: { themeId: string; themeVersion?: string; settings: ThemeSettings; draftArtifactId?: string | null },
  ) {
    return this.theme.saveThemeConfiguration(storeId, expectedRevision, input);
  }

  getAssignment(storeId: string, resourceType: AssignableResourceType, resourceId: string) {
    return this.assignments.getAssignment(storeId, resourceType, resourceId);
  }

  assignTemplate(
    storeId: string,
    input: {
      resourceType: AssignableResourceType;
      resourceId: string;
      templateId: string;
      expectedRevision: number | null;
    },
  ) {
    return this.assignments.assignTemplate(storeId, input);
  }
}
