jest.mock("./exportCatalog", () => ({ exportCatalog: jest.fn() }));
jest.mock("./serveCatalog", () => ({ serveCatalog: jest.fn() }));
jest.mock("./watchCatalog", () => ({ createCatalogInputWatcher: jest.fn() }));

import { catalogPlugin } from "./index";
import { exportCatalog } from "./exportCatalog";
import { serveCatalog } from "./serveCatalog";
import { createCatalogInputWatcher } from "./watchCatalog";

const mockedExport = exportCatalog as jest.MockedFunction<typeof exportCatalog>;
const mockedServe = serveCatalog as jest.MockedFunction<typeof serveCatalog>;
const mockedWatch = createCatalogInputWatcher as jest.MockedFunction<
  typeof createCatalogInputWatcher
>;

function options(subcommand?: string) {
  const rootDirectoryPath = "/tmp/eventvisor-project";
  return {
    rootDirectoryPath,
    projectConfig: {
      catalogExportDirectoryPath: `${rootDirectoryPath}/out`,
      systemDirectoryPath: `${rootDirectoryPath}/.eventvisor`,
      datafilesDirectoryPath: `${rootDirectoryPath}/datafiles`,
      eventsDirectoryPath: `${rootDirectoryPath}/events`,
    },
    datasource: {},
    parsed: {
      _: subcommand ? ["catalog", subcommand] : ["catalog"],
      subcommand,
    },
  } as any;
}

describe("catalog command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedExport.mockResolvedValue(true);
    mockedServe.mockResolvedValue({ close: jest.fn(), triggerReload: jest.fn() });
    mockedWatch.mockReturnValue(jest.fn());
  });

  it("watches and enables live reload when no subcommand is provided", async () => {
    const input = options();
    await catalogPlugin.handler(input);

    expect(mockedExport).toHaveBeenCalledTimes(1);
    expect(mockedServe).toHaveBeenCalledWith(
      expect.objectContaining({ rootDirectoryPath: input.rootDirectoryPath }),
      { liveReload: true },
    );
    expect(mockedWatch).toHaveBeenCalledTimes(1);
  });

  it("keeps explicit export as a one-shot command", async () => {
    await catalogPlugin.handler(options("export"));

    expect(mockedExport).toHaveBeenCalledTimes(1);
    expect(mockedServe).not.toHaveBeenCalled();
    expect(mockedWatch).not.toHaveBeenCalled();
  });
});
