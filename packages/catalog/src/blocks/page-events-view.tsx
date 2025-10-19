import React from "react";
import { Outlet, useParams, useOutletContext } from "react-router";

import { Content } from "./content";
import { useEntity } from "../hooks";
import { Alert } from "./alert";
import { Tabs } from "./tabs";
import { Markdown } from "./markdown";
import { Properties } from "./properties";
import { Tag } from "./tag";

export function DisplayEventOverview() {
  const { entity, name } = useOutletContext() as any;

  return (
    <div className="border-gray-200 py-6">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-gray-500">Name</dt>
          <dd className="mt-1 text-sm text-gray-900">{name}</dd>
        </div>

        <div>
          <dt className="text-sm font-medium text-gray-500">Tags</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {entity.tags.map((tag: string) => (
              <Tag tag={tag} key={tag} />
            ))}
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium text-gray-500">Archived</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {entity.archived === true ? <span>Yes</span> : <span>No</span>}
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium text-gray-500">Deprecated</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {entity.deprecated === true ? <span>Yes</span> : <span>No</span>}
          </dd>
        </div>

        <div className="col-span-2">
          <dt className="text-sm font-medium text-gray-500">Description</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {entity.description.trim().length > 0 ? (
              <Markdown children={entity.description} />
            ) : (
              "n/a"
            )}
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium text-gray-500">Type</dt>
          <dd className="mt-1 text-sm text-gray-900">{entity.type}</dd>
        </div>

        <div className="col-span-2">
          <dt className="text-sm font-medium text-gray-500">Properties</dt>
          <dd className="mt-1 text-sm text-gray-900">
            <Properties properties={entity.properties} required={entity.required} />
          </dd>
        </div>

        {entity.conditions && (
          <div className="col-span-2">
            <dt className="text-sm font-medium text-gray-500">Conditions</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <Properties properties={entity.conditions} />
            </dd>
          </div>
        )}

        {entity.sample && (
          <div className="col-span-2">
            <dt className="text-sm font-medium text-gray-500">Sample</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <Properties properties={entity.sample} />
            </dd>
          </div>
        )}

        {entity.transforms && (
          <div className="col-span-2">
            <dt className="text-sm font-medium text-gray-500">Transforms</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <Properties properties={entity.transforms} />
            </dd>
          </div>
        )}

        {entity.destinations && (
          <div className="col-span-2">
            <dt className="text-sm font-medium text-gray-500">Destination overrides</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <Properties properties={entity.destinations} />
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export const PageEventsView: React.FC = () => {
  const { name = "" } = useParams();

  const entity = useEntity("events", name);

  const tabs = [
    {
      title: "Overview",
      to: `/events/${encodeURIComponent(name)}`,
    },
    // {
    //   title: "History",
    //   to: `/events/${encodeURIComponent(name)}/history`,
    // },
  ];

  return (
    <Content title={`Event: ${name}`} border={false} entityType="event" entityName={name}>
      {!entity && <Alert type="warning">Event not found</Alert>}

      {entity && (
        <>
          <Tabs tabs={tabs} />

          <div className="p-8">
            <Outlet context={{ entity: entity, name: name }} />
          </div>
        </>
      )}
    </Content>
  );
};
