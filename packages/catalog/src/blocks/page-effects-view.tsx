import React from "react";
import { Outlet, useParams, useOutletContext } from "react-router";

import { Content } from "./content";
import { useEntity } from "../hooks";
import { Alert } from "./alert";
import { Tabs } from "./tabs";
import { Markdown } from "./markdown";
import { Tag } from "./tag";

export function DisplayEffectOverview() {
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

        {entity.on && (
          <div className="col-span-2">
            <dt className="text-sm font-medium text-gray-500">On</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <pre>
                <code>{JSON.stringify(entity.on, null, 2)}</code>
              </pre>
            </dd>
          </div>
        )}

        {entity.state && (
          <div className="col-span-2">
            <dt className="text-sm font-medium text-gray-500">State</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <pre>
                <code>{JSON.stringify(entity.state, null, 2)}</code>
              </pre>
            </dd>
          </div>
        )}

        {entity.conditions && (
          <div className="col-span-2">
            <dt className="text-sm font-medium text-gray-500">Conditions</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <pre>
                <code>{JSON.stringify(entity.conditions, null, 2)}</code>
              </pre>
            </dd>
          </div>
        )}

        {entity.steps && (
          <div className="col-span-2">
            <dt className="text-sm font-medium text-gray-500">Steps</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <pre>
                <code>{JSON.stringify(entity.steps, null, 2)}</code>
              </pre>
            </dd>
          </div>
        )}

        {entity.persist && (
          <div className="col-span-2">
            <dt className="text-sm font-medium text-gray-500">Persist</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <pre>
                <code>{JSON.stringify(entity.persist, null, 2)}</code>
              </pre>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export const PageEffectsView: React.FC = () => {
  const { name = "" } = useParams();

  const entity = useEntity("effects", name);

  const tabs = [
    {
      title: "Overview",
      to: `/effects/${encodeURIComponent(name)}`,
    },
    // {
    //   title: "History",
    //   to: `/effects/${encodeURIComponent(name)}/history`,
    // },
  ];

  return (
    <Content title={`Effect: ${name}`} border={false} entityType="effect" entityName={name}>
      {!entity && <Alert type="warning">Effect not found</Alert>}

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
