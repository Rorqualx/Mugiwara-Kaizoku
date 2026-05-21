import React from 'react';

import {
  Stack,
  Text,
  Table
} from '@mantine/core';

import type { ProviderMetadataResponse } from '@/types/search.types';

interface DetailsTabProps {
  metadata: ProviderMetadataResponse;
}

export function DetailsTab({ metadata }: DetailsTabProps): React.ReactElement {
  return (
    <Table>
      <tbody>
        {metadata.alternativeTitles && metadata.alternativeTitles.length > 0 && (
          <tr>
            <td><Text fw={500}>Alternative Titles</Text></td>
            <td>
              <Stack gap={4}>
                {metadata.alternativeTitles.map((title: string, index: number) => (
                  <Text key={index} size="sm">{title}</Text>
                ))}
              </Stack>
            </td>
          </tr>
        )}
        {(metadata.totalChapters ?? metadata.chapters) && (
          <tr>
            <td><Text fw={500}>Total Chapters</Text></td>
            <td>{metadata.totalChapters ?? metadata.chapters}</td>
          </tr>
        )}
        {(metadata.totalVolumes ?? metadata.volumes) && (
          <tr>
            <td><Text fw={500}>Total Volumes</Text></td>
            <td>{metadata.totalVolumes ?? metadata.volumes}</td>
          </tr>
        )}
        {(metadata.rating ?? metadata.score ?? metadata.averageScore) && (
          <tr>
            <td><Text fw={500}>Rating</Text></td>
            <td>{metadata.rating ?? metadata.score ?? metadata.averageScore}/10</td>
          </tr>
        )}
        {metadata.popularity && (
          <tr>
            <td><Text fw={500}>Popularity</Text></td>
            <td>#{metadata.popularity}</td>
          </tr>
        )}
        {metadata.source && (
          <tr>
            <td><Text fw={500}>Source</Text></td>
            <td>{metadata.source}</td>
          </tr>
        )}
      </tbody>
    </Table>
  );
}
