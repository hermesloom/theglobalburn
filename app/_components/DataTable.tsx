"use client";

import React, { useEffect, useState, useRef } from "react";
import { Button } from "@nextui-org/react";
import { apiGet } from "@/app/_components/api";
import BasicTable from "@/app/_components/BasicTable";
import Heading from "@/app/_components/Heading";
import ActionButton, { ActionButtonDef } from "./ActionButton";
import { DeleteOutlined } from "@ant-design/icons";
import { apiDelete } from "@/app/_components/api";

export type DataItem = {
  id: string;
  [key: string]: any;
};

export type FullData = {
  data: DataItem[];
  [key: string]: any;
};

interface DataTableProps {
  endpoint: string;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, item: any, additionalData: any) => React.ReactNode;
  }>;
  title: string;
  globalActions?: ActionButtonDef<FullData>[];
  rowActions?: ActionButtonDef<DataItem>[];
  rowActionsCrud?: {
    delete?: boolean;
  };
}

export default function DataTable({
  endpoint,
  columns,
  title,
  globalActions,
  rowActions,
  rowActionsCrud,
}: DataTableProps) {
  const initialLoadDone = useRef(false);
  const [fullData, setFullData] = useState<FullData | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiGet(endpoint);
      setFullData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadData();
    }
  }, [endpoint]);

  const rowActionsFull: ActionButtonDef<DataItem>[] = rowActions ?? [];
  if (rowActionsCrud?.delete) {
    rowActionsFull.push({
      key: "delete",
      tooltip: "Delete",
      icon: <DeleteOutlined />,
      onClick: async (data) => {
        await apiDelete(endpoint + "/" + data!.id);
        return true;
      },
      successCallback: loadData,
    });
  }

  return (
    <div>
      <Heading>{title}</Heading>
      <div className="flex gap-2 mb-3">
        <Button
          color="primary"
          aria-label={`Reload ${endpoint}`}
          onPress={loadData}
          isLoading={loading}
        >
          {!loading && "Reload"}
        </Button>
        {globalActions && !loading ? (
          <>
            {globalActions.map((action) => (
              <ActionButton
                key={action.key}
                action={{ ...action, successCallback: loadData }}
                data={fullData!}
              />
            ))}
          </>
        ) : null}
      </div>
      {fullData && !loading ? (
        <BasicTable
          data={fullData.data}
          additionalData={fullData}
          columns={columns}
          rowsPerPage={10}
          ariaLabel={`${title} table`}
          rowActions={rowActionsFull}
        />
      ) : null}
    </div>
  );
}
